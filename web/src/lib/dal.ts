import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/roles";

// Data access layer: every page and action gets the signed-in user and
// their businesses from here. Queries run as the user, so the database's
// security rules decide what comes back.

export { ROLE_LABELS, type MemberRole } from "@/lib/roles";

// Remembers which business the person last switched to. It only picks
// among businesses they already belong to; it grants nothing.
export const WORKSPACE_COOKIE = "gd_workspace";

export type Workspace = {
  organizationId: string;
  organizationName: string;
  role: MemberRole;
  displayName: string | null;
  locations: { id: string; name: string; timezone: string }[];
};

export type PendingInvitation = {
  id: string;
  organizationName: string;
  role: MemberRole;
  invitedByName: string | null;
  expiresAt: string;
};

export const getCurrentUser = cache(async () => {
  // Session checks compare token expiry with the current time, so mark
  // this as request-time work before Supabase reads the clock.
  await connection();
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
  const chosen = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  return workspaces.find((w) => w.organizationId === chosen) ?? workspaces[0];
});

// Open invitations sent to the signed-in person's confirmed email.
export const getMyInvitations = cache(async (): Promise<PendingInvitation[]> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_invitations");
  if (error) throw new Error(`Could not load your invitations: ${error.message}`);
  return data.map((i) => ({
    id: i.id,
    organizationName: i.organization_name,
    role: i.role,
    invitedByName: i.invited_by_name,
    expiresAt: i.expires_at,
  }));
});
