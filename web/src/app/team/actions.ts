"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { INVITABLE_ROLES, canManageTeam, type MemberRole } from "@/lib/roles";
import { inviteLink, siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccessValues = { role: string; allLocations: boolean; locationIds: string[] };

export type InviteState =
  | { error?: string; values?: AccessValues & { email: string; displayName: string }; sent?: { email: string; link: string } }
  | undefined;

export type ActionState = { error?: string } | undefined;

function readAccess(formData: FormData): AccessValues {
  return {
    role: String(formData.get("role") ?? ""),
    allLocations: formData.get("allLocations") === "on",
    locationIds: formData.getAll("locationIds").map(String).filter((id) => UUID_PATTERN.test(id)),
  };
}

function checkAccess(v: AccessValues): string | undefined {
  if (!INVITABLE_ROLES.includes(v.role as MemberRole)) return "Choose a role.";
  if (v.role !== "admin" && !v.allLocations && v.locationIds.length === 0) {
    return "Choose at least one location, or all locations.";
  }
}

// The team pages act on the business currently shown. The database
// re-checks the caller's role on every call; this only skips a wasted trip.
async function managedWorkspace() {
  const workspace = await requireWorkspace();
  return canManageTeam(workspace.role) ? workspace : null;
}

export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const values = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    ...readAccess(formData),
  };

  const workspace = await managedWorkspace();
  if (!workspace) return { error: "Only owners and admins can invite staff.", values };
  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 254) return { error: "Enter a valid email address.", values };
  if (values.displayName.length > 120) return { error: "Keep the name under 120 characters.", values };
  const accessError = checkAccess(values);
  if (accessError) return { error: accessError, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member", {
    p_organization_id: workspace.organizationId,
    p_email: values.email,
    p_role: values.role as MemberRole,
    p_location_ids: values.locationIds,
    p_all_locations: values.allLocations,
    p_display_name: values.displayName || undefined,
  });
  if (error) return { error: userMessage(error), values };

  refresh();
  return { sent: { email: values.email, link: inviteLink(await siteOrigin(), values.email) } };
}

export async function cancelInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!UUID_PATTERN.test(invitationId)) return { error: "That invitation isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });
  if (error) return { error: userMessage(error) };
  refresh();
  return undefined;
}

export async function updateMemberAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("memberId") ?? "");
  if (!UUID_PATTERN.test(memberId)) return { error: "That team member isn't valid." };
  const access = readAccess(formData);
  const accessError = checkAccess(access);
  if (accessError) return { error: accessError };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: memberId,
    p_role: access.role as MemberRole,
    p_location_ids: access.locationIds,
    p_all_locations: access.allLocations,
  });
  if (error) return { error: userMessage(error) };
  redirect("/team?saved=1");
}

export async function setMemberAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("memberId") ?? "");
  if (!UUID_PATTERN.test(memberId)) return { error: "That team member isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_active", {
    p_member_id: memberId,
    p_active: formData.get("active") === "true",
  });
  if (error) return { error: userMessage(error) };
  refresh();
  return undefined;
}
