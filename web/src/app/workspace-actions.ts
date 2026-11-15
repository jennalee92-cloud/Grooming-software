"use server";

import { redirect } from "next/navigation";
import { getWorkspaces } from "@/lib/dal";
import { rememberWorkspace } from "@/lib/workspace-cookie";

export async function switchWorkspace(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const workspaces = await getWorkspaces();
  if (workspaces.some((w) => w.organizationId === organizationId)) {
    await rememberWorkspace(organizationId);
  }
  redirect("/");
}
