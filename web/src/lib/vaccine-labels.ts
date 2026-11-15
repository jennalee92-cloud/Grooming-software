import type { PetSpecies } from "@/lib/client-labels";

// Vaccine names and status rules. Safe to import from browser components.

// Suggestions only; staff can type any vaccine name.
export const COMMON_VACCINES: Record<PetSpecies, string[]> = {
  dog: ["Rabies", "DHPP (distemper)", "Bordetella", "Leptospirosis", "Canine influenza"],
  cat: ["Rabies", "FVRCP (distemper)", "FeLV"],
  other: ["Rabies"],
};

// Warn this many days before a vaccine expires.
export const DUE_SOON_DAYS = 30;

export type VaccineStatus = "expired" | "due_soon" | "current";

export const STATUS_LABELS: Record<VaccineStatus, string> = {
  expired: "Expired",
  due_soon: "Due soon",
  current: "Current",
};

const addDays = (day: string, days: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function vaccineStatus(expiresOn: string, today: string): VaccineStatus {
  if (expiresOn < today) return "expired";
  if (expiresOn <= addDays(today, DUE_SOON_DAYS)) return "due_soon";
  return "current";
}

// Same vaccine regardless of spacing or capitals ("rabies " = "Rabies").
export const vaccineKey = (name: string) => name.trim().toLowerCase();

// Rabies is legally required for dogs and cats almost everywhere.
export const needsRabies = (species: PetSpecies) => species === "dog" || species === "cat";

// "Mar 3, 2027" from YYYY-MM-DD, with no time zone shift.
export const vaccineDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export { addDays };
