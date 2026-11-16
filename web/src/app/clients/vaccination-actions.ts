"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, pastDate, required, snapshot, text } from "@/lib/form-fields";
import { canEditClients } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { storeVetRecord, vetRecordFile } from "@/lib/vet-records";

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
    const proof = vetRecordFile(fd, "proof");

    parsed = {
      clientId,
      petId,
      vaccinationId,
      proof,
      row: {
        vaccine: required(fd, "vaccine", 80, "the vaccine name"),
        given_on: givenOn,
        expires_on: expiresOn,
        // A photo of the vet record is proof.
        verified: fd.get("verified") === "on" || proof !== null,
        notes: optional(fd, "notes", 500, "the notes"),
      },
    };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const { clientId, petId, vaccinationId, proof, row } = parsed;
  const supabase = await createClient();
  let savedId = vaccinationId;

  if (vaccinationId) {
    const { data, error } = await supabase.from("pet_vaccinations").update(row)
      .eq("id", vaccinationId).eq("pet_id", petId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: userMessage(error), values };
    if (data.length === 0) return { error: "That record couldn't be updated. It may have been removed.", values };
  } else {
    const { data, error } = await supabase.from("pet_vaccinations")
      .insert({ ...row, organization_id: workspace.organizationId, pet_id: petId }).select("id").single();
    if (error) return { error: userMessage(error), values };
    savedId = data.id;
  }

  const petPage = `/clients/${clientId}/pets/${petId}`;
  if (proof) {
    const stored = await storeVetRecord(workspace, petId, proof, savedId);
    if (stored.error) redirect(`${petPage}?vaccine=uploadError#vaccinations`);
  }
  redirect(`${petPage}?vaccine=${vaccinationId ? "saved" : "added"}#vaccinations`);
}

// A vet record that may cover several vaccines (or isn't tied to one).
export async function uploadVetRecord(_prev: VaccinationFormState, fd: FormData): Promise<VaccinationFormState> {
  const workspace = await requireWorkspace();
  let parsed;
  try {
    if (!canEditClients(workspace.role)) throw new Invalid("Your role can view vet records but not add them.");
    const { clientId, petId } = ids(fd);
    const file = vetRecordFile(fd, "proof");
    if (!file) throw new Invalid("Choose a photo or PDF of the vet record.");
    const linked = text(fd, "linkVaccinationId");
    if (linked && !UUID_PATTERN.test(linked)) throw new Invalid("Choose the vaccine from the list.");
    parsed = { clientId, petId, file, linked: linked || null };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }

  const stored = await storeVetRecord(workspace, parsed.petId, parsed.file, parsed.linked);
  if (stored.error) return { error: stored.error };

  // Linking a vet record to a vaccine counts as proof seen.
  if (parsed.linked) {
    const supabase = await createClient();
    await supabase.from("pet_vaccinations").update({ verified: true })
      .eq("id", parsed.linked).eq("pet_id", parsed.petId).eq("organization_id", workspace.organizationId);
  }
  redirect(`/clients/${parsed.clientId}/pets/${parsed.petId}?vaccine=uploaded#vet-records`);
}

export async function removeVetRecord(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canEditClients(workspace.role)) return { error: "Your role can view vet records but not change them." };
  const documentId = text(fd, "documentId");
  const petId = text(fd, "petId");
  if (!UUID_PATTERN.test(documentId) || !UUID_PATTERN.test(petId)) return { error: "That file isn't valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("vaccination_documents").update({ removed_at: new Date().toISOString() })
    .eq("id", documentId).eq("pet_id", petId).eq("organization_id", workspace.organizationId).select("id");
  if (error) return { error: userMessage(error) };
  if (data.length === 0) return { error: "That file couldn't be removed." };
  refresh();
  return undefined;
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
