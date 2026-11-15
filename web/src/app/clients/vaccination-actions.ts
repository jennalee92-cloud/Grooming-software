"use server";

import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, pastDate, required, snapshot, text } from "@/lib/form-fields";
import { canEditClients } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type VaccinationFormState = { error?: string; values?: Record<string, string> } | undefined;
export type ActionState = { error?: string } | undefined;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function ids(fd: FormData) {
  const clientId = text(fd, "clientId");
  const petId = text(fd, "petId");
  const vaccinationId = text(fd, "vaccinationId");
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId) || (vaccinationId && !UUID_PATTERN.test(vaccinationId))) {
    throw new Invalid("That vaccination record isn't valid.");
  }
  return { clientId, petId, vaccinationId };
}

// Adds a vaccination record, or fixes an existing one.
export async function saveVaccination(_prev: VaccinationFormState, fd: FormData): Promise<VaccinationFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  let parsed;

  try {
    if (!canEditClients(workspace.role)) throw new Invalid("Your role can view vaccination records but not change them.");
    const { clientId, petId, vaccinationId } = ids(fd);

    const givenRaw = text(fd, "givenOn");
    const givenOn = givenRaw ? pastDate(givenRaw, "1990-01-01", "Enter the date given. It can't be in the future.") : null;
    const expiresOn = text(fd, "expiresOn");
    if (!DAY.test(expiresOn) || expiresOn < "1990-01-01" || expiresOn > "2100-12-31") throw new Invalid("Enter the expiry date.");
    if (givenOn && expiresOn < givenOn) throw new Invalid("The expiry date can't be before the date given.");

    parsed = {
      clientId,
      petId,
      vaccinationId,
      row: {
        vaccine: required(fd, "vaccine", 80, "the vaccine name"),
        given_on: givenOn,
        expires_on: expiresOn,
        verified: fd.get("verified") === "on",
        notes: optional(fd, "notes", 500, "the notes"),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const { clientId, petId, vaccinationId, row } = parsed;
  const supabase = await createClient();

  if (vaccinationId) {
    const { data, error } = await supabase.from("pet_vaccinations").update(row)
      .eq("id", vaccinationId).eq("pet_id", petId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: userMessage(error), values };
    if (data.length === 0) return { error: "That record couldn't be updated. It may have been removed.", values };
  } else {
    const { error } = await supabase.from("pet_vaccinations")
      .insert({ ...row, organization_id: workspace.organizationId, pet_id: petId });
    if (error) return { error: userMessage(error), values };
  }

  redirect(`/clients/${clientId}/pets/${petId}?vaccine=${vaccinationId ? "saved" : "added"}#vaccinations`);
}

export async function removeVaccination(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canEditClients(workspace.role)) return { error: "Your role can view vaccination records but not change them." };
  let clientId, petId, vaccinationId;
  try {
    ({ clientId, petId, vaccinationId } = ids(fd));
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }
  if (!vaccinationId) return { error: "That vaccination record isn't valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("pet_vaccinations").update({ removed_at: new Date().toISOString() })
    .eq("id", vaccinationId).eq("pet_id", petId).eq("organization_id", workspace.organizationId).select("id");
  if (error) return { error: userMessage(error) };
  if (data.length === 0) return { error: "That record couldn't be removed." };
  redirect(`/clients/${clientId}/pets/${petId}?vaccine=removed#vaccinations`);
}
