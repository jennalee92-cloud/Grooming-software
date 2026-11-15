import type { ClientRow, PetRow } from "@/lib/clients";

// Saved records → starting values for the edit forms (field names match the forms).

export const clientDefaults = (c: ClientRow): Record<string, string> => ({
  firstName: c.first_name,
  lastName: c.last_name,
  phone: c.phone ?? "",
  altPhone: c.alt_phone ?? "",
  email: c.email ?? "",
  preferredContact: c.preferred_contact ?? "",
  homeLocationId: c.home_location_id ?? "",
  address: c.address ?? "",
  emergencyContact: c.emergency_contact ?? "",
  notes: c.notes ?? "",
});

export const petDefaults = (p: PetRow): Record<string, string> => ({
  name: p.name,
  species: p.species,
  breed: p.breed ?? "",
  sex: p.sex,
  fixed: p.fixed === null ? "" : p.fixed ? "yes" : "no",
  birthDate: p.birth_date ?? "",
  weightLbs: p.weight_lbs === null ? "" : String(p.weight_lbs),
  color: p.color ?? "",
  coat: p.coat ?? "",
  handleWithCare: p.handle_with_care ? "on" : "",
  temperament: p.temperament ?? "",
  allergies: p.allergies ?? "",
  medicalNotes: p.medical_notes ?? "",
  groomingInstructions: p.grooming_instructions ?? "",
});
