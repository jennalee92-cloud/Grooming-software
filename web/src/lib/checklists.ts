import "server-only";
import { cache } from "react";
import { periodStart } from "@/lib/checklist-labels";
import type { Workspace } from "@/lib/dal";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type ChecklistRow = Database["public"]["Tables"]["checklists"]["Row"];
export type TaskRow = Database["public"]["Tables"]["checklist_tasks"]["Row"];
export type Checklist = ChecklistRow & { tasks: TaskRow[] };

// Every checklist with its live tasks (in order), current ones first.
export const getChecklists = cache(async (workspace: Workspace) => {
  const supabase = await createClient();
  const [lists, tasks] = await Promise.all([
    supabase.from("checklists").select("*").eq("organization_id", workspace.organizationId).order("position").order("name"),
    supabase.from("checklist_tasks").select("*").eq("organization_id", workspace.organizationId).is("archived_at", null).order("position"),
  ]);
  if (lists.error) throw new Error(`Could not load checklists: ${lists.error.message}`);
  if (tasks.error) throw new Error(`Could not load checklist tasks: ${tasks.error.message}`);

  const all: Checklist[] = lists.data.map((c) => ({ ...c, tasks: tasks.data.filter((t) => t.checklist_id === c.id) }));
  return { active: all.filter((c) => !c.archived_at), archived: all.filter((c) => c.archived_at) };
});

export type Tick = { taskId: string; checkedBy: string | null; checkedAt: string; note: string | null };

// The checklists that apply at a location, with this period's ticks.
export async function getChecklistsAt(workspace: Workspace, locationId: string, today: string) {
  const { active } = await getChecklists(workspace);
  const lists = active.filter((c) => (c.location_id === null || c.location_id === locationId) && c.tasks.length > 0);
  const periods = [...new Set(lists.map((c) => periodStart(c.frequency, today)))];

  const ticks = new Map<string, Tick>();
  if (lists.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("checklist_checks").select("task_id, checked_by, checked_at, note, period_start")
      .eq("organization_id", workspace.organizationId).eq("location_id", locationId).in("period_start", periods);
    if (error) throw new Error(`Could not load checklist ticks: ${error.message}`);
    const periodOf = new Map(lists.flatMap((c) => c.tasks.map((t) => [t.id, periodStart(c.frequency, today)])));
    for (const t of data) {
      // Only ticks for each task's own current period count.
      if (periodOf.get(t.task_id) === t.period_start) {
        ticks.set(t.task_id, { taskId: t.task_id, checkedBy: t.checked_by, checkedAt: t.checked_at, note: t.note });
      }
    }
  }
  return { lists, ticks };
}
