import "server-only";
import { cache } from "react";
import type { Workspace } from "@/lib/dal";
import { toMenuItem } from "@/lib/service-labels";
import { createClient } from "@/lib/supabase/server";

// The business's service menu: current services first (by name), then retired.
export const getServices = cache(async (workspace: Workspace) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select("*")
    .eq("organization_id", workspace.organizationId)
    .order("name");
  if (error) throw new Error(`Could not load the service menu: ${error.message}`);
  return {
    active: data.filter((s) => !s.retired_at),
    retired: data.filter((s) => s.retired_at),
  };
});

export async function getMenu(workspace: Workspace) {
  return (await getServices(workspace)).active.map(toMenuItem);
}
