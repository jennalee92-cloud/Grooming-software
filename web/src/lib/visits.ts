import "server-only";
import { cache } from "react";
import { requireUser, type Workspace } from "@/lib/dal";
import { ROLE_LABELS } from "@/lib/roles";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Visit history is append-only: a correction is a new row pointing at the
// version it replaces. These helpers turn the rows back into "the current
// version of each visit, plus the versions it replaced".

export type VisitLine = Database["public"]["Tables"]["visit_services"]["Row"];
// A visit version with the services charged on it (in the order entered).
export type VisitRow = Database["public"]["Tables"]["grooming_visits"]["Row"] & { visit_services: VisitLine[] };

export const visitTotal = (v: VisitRow) => v.visit_services.reduce((sum, l) => sum + l.price_cents, 0);

export type Visit = {
  current: VisitRow;
  // Older versions, newest first. Empty if never corrected.
  earlier: VisitRow[];
};

export type TeamOption = { memberId: string; userId: string; label: string; active: boolean };

// Today's date (YYYY-MM-DD) where the business is.
export const todayIn = (timeZone?: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function buildVisits(rows: VisitRow[]): { visits: Visit[]; removed: Visit[] } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const corrected = new Set(rows.flatMap((r) => (r.corrects_visit_id ? [r.corrects_visit_id] : [])));

  const all = rows
    .filter((r) => !corrected.has(r.id))
    .map((current) => {
      const earlier: VisitRow[] = [];
      let prev = current.corrects_visit_id ? byId.get(current.corrects_visit_id) : undefined;
      while (prev) {
        earlier.push(prev);
        prev = prev.corrects_visit_id ? byId.get(prev.corrects_visit_id) : undefined;
      }
      return { current, earlier };
    })
    .sort((a, b) => {
      if (a.current.visited_on !== b.current.visited_on) return a.current.visited_on < b.current.visited_on ? 1 : -1;
      const rootA = a.earlier.at(-1) ?? a.current;
      const rootB = b.earlier.at(-1) ?? b.current;
      return rootA.created_at < rootB.created_at ? 1 : -1;
    });

  return { visits: all.filter((v) => !v.current.voided), removed: all.filter((v) => v.current.voided) };
}

export const getPetVisits = cache(async (workspace: Workspace, petId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("grooming_visits").select("*, visit_services(*)")
    .eq("organization_id", workspace.organizationId).eq("pet_id", petId);
  if (error) throw new Error(`Could not load visit history: ${error.message}`);
  for (const v of data) v.visit_services.sort((a, b) => a.position - b.position);
  return buildVisits(data);
});

// Everyone on the team (including people whose access is off, so old
// visits still show their names), labelled for display.
export const getTeamOptions = cache(async (workspace: Workspace): Promise<TeamOption[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("organization_members")
    .select("id, user_id, display_name, role, status")
    .eq("organization_id", workspace.organizationId)
    .order("display_name");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return data.map((m) => ({
    memberId: m.id,
    userId: m.user_id,
    label: `${m.display_name ?? `${ROLE_LABELS[m.role]} (no name set)`}${m.user_id === user.id ? " (you)" : ""}`,
    active: m.status === "active",
  }));
});

// Visits whose current version is on this day and wasn't removed.
export async function countVisitsOn(workspace: Workspace, day: string) {
  const supabase = await createClient();
  const onDay = await supabase.from("grooming_visits").select("id, voided")
    .eq("organization_id", workspace.organizationId).eq("visited_on", day);
  if (onDay.error) throw new Error(`Could not count visits: ${onDay.error.message}`);
  if (onDay.data.length === 0) return 0;

  const replaced = await supabase.from("grooming_visits").select("corrects_visit_id")
    .eq("organization_id", workspace.organizationId)
    .in("corrects_visit_id", onDay.data.map((v) => v.id));
  if (replaced.error) throw new Error(`Could not count visits: ${replaced.error.message}`);

  const superseded = new Set(replaced.data.map((r) => r.corrects_visit_id));
  return onDay.data.filter((v) => !v.voided && !superseded.has(v.id)).length;
}
