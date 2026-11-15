import "server-only";
import { cache } from "react";
import type { PetSpecies } from "@/lib/client-labels";
import type { Workspace } from "@/lib/dal";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { DUE_SOON_DAYS, needsRabies, vaccineKey, vaccineStatus, type VaccineStatus } from "@/lib/vaccine-labels";

export type VaccinationRow = Database["public"]["Tables"]["pet_vaccinations"]["Row"];
export type CurrentVaccine = VaccinationRow & { status: VaccineStatus };

export type PetVaccines = {
  // Latest record per vaccine, soonest expiry first.
  current: CurrentVaccine[];
  // Older records that a renewal replaced, newest first.
  earlier: VaccinationRow[];
  removed: VaccinationRow[];
  expired: CurrentVaccine[];
  dueSoon: CurrentVaccine[];
  missingRabies: boolean;
};

export const getPetVaccinations = cache(async (workspace: Workspace, petId: string, species: PetSpecies, today: string): Promise<PetVaccines> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("pet_vaccinations").select("*")
    .eq("organization_id", workspace.organizationId).eq("pet_id", petId)
    .order("expires_on", { ascending: false });
  if (error) throw new Error(`Could not load vaccinations: ${error.message}`);

  const live = data.filter((v) => !v.removed_at);
  const latest = new Map<string, VaccinationRow>();
  for (const v of live) if (!latest.has(vaccineKey(v.vaccine))) latest.set(vaccineKey(v.vaccine), v);

  const current = [...latest.values()]
    .map((v) => ({ ...v, status: vaccineStatus(v.expires_on, today) }))
    .sort((a, b) => (a.expires_on < b.expires_on ? -1 : 1));
  const currentIds = new Set(current.map((v) => v.id));

  return {
    current,
    earlier: live.filter((v) => !currentIds.has(v.id)),
    removed: data.filter((v) => v.removed_at),
    expired: current.filter((v) => v.status === "expired"),
    dueSoon: current.filter((v) => v.status === "due_soon"),
    // "Rabies", "Rabies (3 year)" and so on all count.
    missingRabies: needsRabies(species) && ![...latest.keys()].some((k) => k.includes("rabies")),
  };
});

// For a household's pets: pet id → names of vaccines whose latest record has expired.
export async function getExpiredByPet(workspace: Workspace, petIds: string[], today: string) {
  const expired = new Map<string, string[]>();
  if (petIds.length === 0) return expired;
  const supabase = await createClient();
  const { data, error } = await supabase.from("pet_vaccinations").select("pet_id, vaccine, expires_on")
    .eq("organization_id", workspace.organizationId).in("pet_id", petIds).is("removed_at", null)
    .order("expires_on", { ascending: false });
  if (error) throw new Error(`Could not load vaccinations: ${error.message}`);

  const seen = new Set<string>();
  for (const v of data) {
    const key = `${v.pet_id}:${vaccineKey(v.vaccine)}`;
    if (seen.has(key)) continue; // an earlier record that a renewal replaced
    seen.add(key);
    if (v.expires_on < today) expired.set(v.pet_id, [...(expired.get(v.pet_id) ?? []), v.vaccine]);
  }
  return expired;
}

export async function getVaccinesDue(workspace: Workspace) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vaccines_due", {
    p_organization_id: workspace.organizationId,
    p_within_days: DUE_SOON_DAYS,
  });
  if (error) throw new Error(`Could not load vaccines due: ${error.message}`);
  return data;
}
