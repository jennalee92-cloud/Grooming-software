"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ContactMethod, PetSex, PetSpecies } from "@/lib/client-labels";
import { requireWorkspace, type Workspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { canArchiveClients, canEditClients } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;
export type ActionState = { error?: string } | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIES: PetSpecies[] = ["dog", "cat", "other"];
const SEXES: PetSex[] = ["female", "male", "unknown"];
const CONTACTS: ContactMethod[] = ["call", "text", "email"];

// ---------------------------------------------------------------------
// Field helpers. Each limit matches the database's own check.
// ---------------------------------------------------------------------
const text = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

function snapshot(fd: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

class Invalid extends Error {}

function optional(fd: FormData, name: string, max: number, label: string) {
  const value = text(fd, name);
  if (value.length > max) throw new Invalid(`Keep ${label} under ${max} characters.`);
  return value || null;
}

function required(fd: FormData, name: string, max: number, label: string) {
  const value = optional(fd, name, max, label);
  if (!value) throw new Invalid(`Enter ${label}.`);
  return value;
}

function parseClient(fd: FormData, workspace: Workspace) {
  const email = optional(fd, "email", 254, "the email");
  if (email && !EMAIL_PATTERN.test(email)) throw new Invalid("Enter a valid email address, or leave it blank.");

  const contact = text(fd, "preferredContact");
  const homeLocation = text(fd, "homeLocationId");
  if (homeLocation && !workspace.locations.some((l) => l.id === homeLocation)) {
    throw new Invalid("Choose a home location from the list.");
  }

  return {
    first_name: required(fd, "firstName", 80, "a first name"),
    last_name: optional(fd, "lastName", 80, "the last name") ?? "",
    phone: optional(fd, "phone", 40, "the phone number"),
    alt_phone: optional(fd, "altPhone", 40, "the second phone number"),
    email: email?.toLowerCase() ?? null,
    preferred_contact: CONTACTS.includes(contact as ContactMethod) ? (contact as ContactMethod) : null,
    home_location_id: homeLocation || null,
    address: optional(fd, "address", 300, "the address"),
    emergency_contact: optional(fd, "emergencyContact", 200, "the emergency contact"),
    notes: optional(fd, "notes", 4000, "the notes"),
  };
}

function parsePet(fd: FormData) {
  const species = text(fd, "species");
  const sex = text(fd, "sex");
  const fixed = text(fd, "fixed");

  const birthDate = text(fd, "birthDate");
  if (birthDate) {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate < "1980-01-01" || birthDate > tomorrow) {
      throw new Invalid("Enter a birth date that isn't in the future, or leave it blank.");
    }
  }

  const weightText = text(fd, "weightLbs");
  const weight = weightText ? Number(weightText) : null;
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight >= 400)) {
    throw new Invalid("Enter a weight in pounds between 0 and 400, or leave it blank.");
  }

  return {
    name: required(fd, "name", 80, "the pet's name"),
    species: SPECIES.includes(species as PetSpecies) ? (species as PetSpecies) : "dog",
    breed: optional(fd, "breed", 80, "the breed"),
    sex: SEXES.includes(sex as PetSex) ? (sex as PetSex) : "unknown",
    fixed: fixed === "yes" ? true : fixed === "no" ? false : null,
    birth_date: birthDate || null,
    weight_lbs: weight === null ? null : Math.round(weight * 10) / 10,
    color: optional(fd, "color", 80, "the color"),
    coat: optional(fd, "coat", 120, "the coat description"),
    handle_with_care: fd.get("handleWithCare") === "on",
    temperament: optional(fd, "temperament", 1000, "the temperament notes"),
    allergies: optional(fd, "allergies", 1000, "the allergies"),
    medical_notes: optional(fd, "medicalNotes", 2000, "the medical notes"),
    grooming_instructions: optional(fd, "groomingInstructions", 4000, "the grooming instructions"),
  };
}

async function editableWorkspace() {
  const workspace = await requireWorkspace();
  if (!canEditClients(workspace.role)) throw new Invalid("Your role can view clients and pets but not change them.");
  return workspace;
}

// ---------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------
export async function saveClient(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = snapshot(fd);
  const clientId = text(fd, "clientId");
  let workspace: Workspace;
  let row: ReturnType<typeof parseClient>;
  let firstPet: { name: string; breed: string | null; species: PetSpecies } | null = null;

  try {
    workspace = await editableWorkspace();
    if (clientId && !UUID_PATTERN.test(clientId)) throw new Invalid("That client isn't valid.");
    row = parseClient(fd, workspace);
    const petName = optional(fd, "petName", 80, "the pet's name");
    if (!clientId && petName) {
      const species = text(fd, "petSpecies");
      firstPet = {
        name: petName,
        breed: optional(fd, "petBreed", 80, "the breed"),
        species: SPECIES.includes(species as PetSpecies) ? (species as PetSpecies) : "dog",
      };
    }
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();

  if (clientId) {
    const { data, error } = await supabase.from("clients").update(row)
      .eq("id", clientId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: userMessage(error), values };
    if (data.length === 0) return { error: "That client couldn't be updated. It may have been archived or moved.", values };
    redirect(`/clients/${clientId}?saved=1`);
  }

  const { data, error } = await supabase.from("clients")
    .insert({ ...row, organization_id: workspace.organizationId }).select("id").single();
  if (error) return { error: userMessage(error), values };

  if (firstPet) {
    const pet = await supabase.from("pets").insert({ ...firstPet, organization_id: workspace.organizationId, client_id: data.id });
    if (pet.error) redirect(`/clients/${data.id}?petError=1`);
  }
  redirect(`/clients/${data.id}?created=1`);
}

export async function setClientArchived(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canArchiveClients(workspace.role)) return { error: "Only owners, admins and managers can archive clients." };
  const clientId = text(fd, "clientId");
  if (!UUID_PATTERN.test(clientId)) return { error: "That client isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_client_archived", { p_client_id: clientId, p_archived: fd.get("archived") === "true" });
  if (error) return { error: userMessage(error) };
  refresh();
  return undefined;
}

// ---------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------
export async function savePet(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = snapshot(fd);
  const clientId = text(fd, "clientId");
  const petId = text(fd, "petId");
  let workspace: Workspace;
  let row: ReturnType<typeof parsePet>;

  try {
    workspace = await editableWorkspace();
    if (!UUID_PATTERN.test(clientId) || (petId && !UUID_PATTERN.test(petId))) throw new Invalid("That pet isn't valid.");
    row = parsePet(fd);
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();

  if (petId) {
    const { data, error } = await supabase.from("pets").update(row)
      .eq("id", petId).eq("client_id", clientId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: userMessage(error), values };
    if (data.length === 0) return { error: "That pet couldn't be updated. It may have been moved or archived.", values };
    redirect(`/clients/${clientId}/pets/${petId}?saved=1`);
  }

  const { data, error } = await supabase.from("pets")
    .insert({ ...row, organization_id: workspace.organizationId, client_id: clientId }).select("id").single();
  if (error) return { error: userMessage(error), values };
  redirect(`/clients/${clientId}/pets/${data.id}?created=1`);
}

export async function setPetArchived(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canArchiveClients(workspace.role)) return { error: "Only owners, admins and managers can archive pets." };
  const petId = text(fd, "petId");
  if (!UUID_PATTERN.test(petId)) return { error: "That pet isn't valid." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_pet_archived", { p_pet_id: petId, p_archived: fd.get("archived") === "true" });
  if (error) return { error: userMessage(error) };
  refresh();
  return undefined;
}
