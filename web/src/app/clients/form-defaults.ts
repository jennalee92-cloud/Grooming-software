import type { ClientRow, PetRow } from "@/lib/clients";
import { MAX_EXTRAS, moneyInput } from "@/lib/service-labels";
import type { VisitRow } from "@/lib/visits";

// Lines for services still on the menu come back as menu picks; anything
// else (extra charges, retired services) comes back as an extra charge.
export function visitDefaults(v: VisitRow, menuIds: Set<string>): Record<string, string> {
  const values: Record<string, string> = {
    visitedOn: v.visited_on,
    locationId: v.location_id,
    groomerMemberId: v.groomer_member_id ?? "",
    weightLbs: v.weight_lbs === null ? "" : String(v.weight_lbs),
    petSize: v.pet_size ?? "",
    services: v.services ?? "",
    behavior: v.behavior ?? "",
    cutDetails: v.cut_details ?? "",
    notes: v.notes ?? "",
  };
  let extra = 0;
  for (const line of v.visit_services) {
    if (line.service_id && menuIds.has(line.service_id)) {
      values[`svc_${line.service_id}`] = "on";
      values[`price_${line.service_id}`] = moneyInput(line.price_cents);
    } else if (extra < MAX_EXTRAS) {
      values[`extraName_${extra}`] = line.name;
      values[`extraPrice_${extra}`] = moneyInput(line.price_cents);
      extra++;
    }
  }
  return values;
}

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
