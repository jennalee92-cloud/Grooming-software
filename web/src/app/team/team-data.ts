import "server-only";
import { cache } from "react";
import { requireUser, type Workspace } from "@/lib/dal";
import type { MemberRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type TeamMember = {
  memberId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: MemberRole;
  active: boolean;
  allLocations: boolean;
  locationIds: string[];
  isYou: boolean;
  canEdit: boolean;
};

export type OpenInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  displayName: string | null;
  allLocations: boolean;
  locationIds: string[];
  expiresAt: string;
  expired: boolean;
  canCancel: boolean;
};

// Mirrors the database rules so the page only offers changes that will be
// allowed. The database still enforces them on every change.
function canEditMember(callerRole: MemberRole, target: { role: MemberRole; isYou: boolean }) {
  if (target.isYou || target.role === "owner") return false;
  return callerRole === "owner" || target.role !== "admin";
}

export const getTeam = cache(async (workspace: Workspace): Promise<TeamMember[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("team_directory", { p_organization_id: workspace.organizationId });
  if (error) throw new Error(`Could not load your team: ${error.message}`);

  return data.map((m) => {
    const isYou = m.user_id === user.id;
    return {
      memberId: m.member_id,
      userId: m.user_id,
      email: m.email,
      displayName: m.display_name,
      role: m.role,
      active: m.status === "active",
      allLocations: m.all_locations,
      locationIds: m.location_ids ?? [],
      isYou,
      canEdit: canEditMember(workspace.role, { role: m.role, isYou }),
    };
  });
});

export const getOpenInvitations = cache(async (workspace: Workspace): Promise<OpenInvitation[]> => {
  const supabase = await createClient();
  const invites = await supabase
    .from("invitations")
    .select("id, email, role, display_name, all_locations, expires_at")
    .eq("organization_id", workspace.organizationId)
    .is("accepted_at", null)
    .is("declined_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (invites.error) throw new Error(`Could not load invitations: ${invites.error.message}`);
  if (invites.data.length === 0) return [];

  const links = await supabase
    .from("invitation_locations")
    .select("invitation_id, location_id")
    .in("invitation_id", invites.data.map((i) => i.id));
  if (links.error) throw new Error(`Could not load invitation locations: ${links.error.message}`);

  const now = Date.now();
  return invites.data.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    displayName: i.display_name,
    allLocations: i.all_locations,
    locationIds: links.data.filter((l) => l.invitation_id === i.id).map((l) => l.location_id),
    expiresAt: i.expires_at,
    expired: new Date(i.expires_at).getTime() <= now,
    canCancel: workspace.role === "owner" || i.role !== "admin",
  }));
});

export function locationSummary(
  access: { role: MemberRole; allLocations: boolean; locationIds: string[] },
  locations: { id: string; name: string }[],
) {
  if (access.role === "owner" || access.role === "admin" || access.allLocations) return "All locations";
  const names = locations.filter((l) => access.locationIds.includes(l.id)).map((l) => l.name);
  return names.length ? names.join(", ") : "No locations yet";
}
