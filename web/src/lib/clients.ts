import "server-only";
import { cache } from "react";
import type { PetSpecies } from "@/lib/client-labels";
import type { Workspace } from "@/lib/dal";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export { CONTACT_LABELS, SEX_LABELS, SPECIES_LABELS } from "@/lib/client-labels";

// Client and pet reads. They run as the signed-in user, so row-level
// security decides what comes back; the organization filter just keeps
// results to the business currently shown.

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type PetRow = Database["public"]["Tables"]["pets"]["Row"];
export type PetSummary = { id: string; name: string; species: PetSpecies; breed: string | null; handle_with_care: boolean };

export type ClientSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  archived: boolean;
  pets: PetSummary[];
};

export const clientName = (c: { first_name: string; last_name: string } | { firstName: string; lastName: string }) =>
  ("first_name" in c ? `${c.first_name} ${c.last_name}` : `${c.firstName} ${c.lastName}`).trim();

export async function searchClients(workspace: Workspace, query: string, includeArchived: boolean): Promise<ClientSearchResult[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_clients", {
    p_organization_id: workspace.organizationId,
    p_query: query,
    p_include_archived: includeArchived,
  });
  if (error) throw new Error(`Could not search clients: ${error.message}`);
  return data.map((c) => ({
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    phone: c.phone,
    email: c.email,
    archived: c.archived_at !== null,
    pets: (c.pets ?? []) as PetSummary[],
  }));
}

export const getClientWithPets = cache(async (workspace: Workspace, clientId: string) => {
  const supabase = await createClient();
  const [client, pets] = await Promise.all([
    supabase.from("clients").select("*").eq("organization_id", workspace.organizationId).eq("id", clientId).maybeSingle(),
    supabase.from("pets").select("*").eq("organization_id", workspace.organizationId).eq("client_id", clientId)
      .order("archived_at", { ascending: true, nullsFirst: true }).order("name"),
  ]);
  if (client.error) throw new Error(`Could not load the client: ${client.error.message}`);
  if (pets.error) throw new Error(`Could not load pets: ${pets.error.message}`);
  if (!client.data) return null;
  return { client: client.data, pets: pets.data };
});

export async function countActivePets(workspace: Workspace) {
  const supabase = await createClient();
  const { count, error } = await supabase.from("pets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", workspace.organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Could not count pets: ${error.message}`);
  return count ?? 0;
}

// "3 yrs", "8 mos" from a birth date, in whole units.
export function petAge(birthDate: string | null) {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} ${months === 1 ? "mo" : "mos"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "yr" : "yrs"}`;
}
