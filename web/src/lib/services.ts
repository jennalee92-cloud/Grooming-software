import "server-only";
import { cache } from "react";
import type { Workspace } from "@/lib/dal";
import { toMenuItem, type BreedPrice } from "@/lib/service-labels";
import { createClient } from "@/lib/supabase/server";

// The business's service menu: current services first (by name), then
// retired, plus each service's breed prices (service id → prices).
export const getServices = cache(async (workspace: Workspace) => {
  const supabase = await createClient();
  const [services, breeds] = await Promise.all([
    supabase.from("services").select("*").eq("organization_id", workspace.organizationId).order("name"),
    supabase.from("service_breed_prices").select("service_id, breed, price_cents")
      .eq("organization_id", workspace.organizationId).order("breed"),
  ]);
  if (services.error) throw new Error(`Could not load the service menu: ${services.error.message}`);
  if (breeds.error) throw new Error(`Could not load breed prices: ${breeds.error.message}`);

  const breedPrices = new Map<string, BreedPrice[]>();
  for (const b of breeds.data) {
    breedPrices.set(b.service_id, [...(breedPrices.get(b.service_id) ?? []), { breed: b.breed, price_cents: b.price_cents }]);
  }

  return {
    active: services.data.filter((s) => !s.retired_at),
    retired: services.data.filter((s) => s.retired_at),
    breedPrices,
  };
});

export async function getMenu(workspace: Workspace) {
  const { active, breedPrices } = await getServices(workspace);
  return active.map((s) => toMenuItem(s, breedPrices.get(s.id)));
}
