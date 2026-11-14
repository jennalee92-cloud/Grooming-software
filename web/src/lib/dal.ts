import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Data access layer: every page and action gets the signed-in user and
// their businesses from here. Queries run as the user, so the database's
// security rules decide what comes back.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export type Workspace = {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  displayName: string | null;
  locations: { id: string; name: string; timezone: string }[];
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  groomer: "Groomer",
  bather: "Bather",
  front_desk: "Front desk",
};

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

export const getWorkspaces = cache(async (): Promise<Workspace[]> => {
  const user = await requireUser();
  const supabase = await createClient();

  const [members, locations] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, display_name, organization:organizations(id, name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("locations")
      .select("id, name, timezone, organization_id")
      .is("archived_at", null)
      .order("created_at"),
  ]);

  if (members.error) throw new Error(`Could not load your businesses: ${members.error.message}`);
  if (locations.error) throw new Error(`Could not load your locations: ${locations.error.message}`);

  return members.data.flatMap((m) => {
    const org = m.organization;
    if (!org) return [];
    return [{
      organizationId: org.id,
      organizationName: org.name,
      role: m.role,
      displayName: m.display_name,
      locations: locations.data
        .filter((l) => l.organization_id === org.id)
        .map(({ id, name, timezone }) => ({ id, name, timezone })),
    }];
  });
});

// The business shown in the app. Sends people with no business to set one up.
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const workspaces = await getWorkspaces();
  if (workspaces.length === 0) redirect("/onboarding");
  return workspaces[0];
});
