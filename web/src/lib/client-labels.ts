import type { Database } from "@/lib/supabase/database.types";

// Labels for client and pet fields. Safe to import from browser components.

export type PetSpecies = Database["public"]["Enums"]["pet_species"];
export type PetSex = Database["public"]["Enums"]["pet_sex"];
export type ContactMethod = Database["public"]["Enums"]["contact_method"];

export const SPECIES_LABELS: Record<PetSpecies, string> = { dog: "Dog", cat: "Cat", other: "Other" };
export const SEX_LABELS: Record<PetSex, string> = { female: "Female", male: "Male", unknown: "Unknown" };
export const CONTACT_LABELS: Record<ContactMethod, string> = { call: "Phone call", text: "Text message", email: "Email" };
