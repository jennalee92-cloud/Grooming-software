"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { rememberWorkspace } from "@/lib/workspace-cookie";

export type InvitationResponseState = { error?: string } | undefined;

export async function respondToInvitation(
  _prev: InvitationResponseState,
  formData: FormData,
): Promise<InvitationResponseState> {
  await requireUser();
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!UUID_PATTERN.test(invitationId)) return { error: "That invitation isn't valid." };

  const supabase = await createClient();

  if (formData.get("intent") === "decline") {
    const { error } = await supabase.rpc("decline_invitation", { p_invitation_id: invitationId });
    if (error) return { error: userMessage(error) };
    refresh();
    return undefined;
  }

  const { data: organizationId, error } = await supabase.rpc("accept_invitation", { p_invitation_id: invitationId });
  if (error) return { error: userMessage(error) };

  // Open the business they just joined.
  await rememberWorkspace(organizationId);
  redirect("/");
}
