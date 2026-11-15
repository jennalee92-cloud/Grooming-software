import type { Database } from "@/lib/supabase/database.types";

// Service menu labels, prices and sizes. Safe to import from browser components.

export type PetSize = Database["public"]["Enums"]["pet_size"];
export type ServicePricing = Database["public"]["Enums"]["service_pricing"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export const PET_SIZES: PetSize[] = ["small", "medium", "large", "xlarge"];

// Extra-charge rows (not on the menu) the visit form can send.
export const MAX_EXTRAS = 10;

export const SIZE_LABELS: Record<PetSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xlarge: "X-Large",
};

// A starting suggestion only; staff pick the size on each visit.
export const SIZE_HINTS: Record<PetSize, string> = {
  small: "up to 20 lbs",
  medium: "21 to 50 lbs",
  large: "51 to 90 lbs",
  xlarge: "over 90 lbs",
};

export function suggestSize(weightLbs: number | null | undefined): PetSize | null {
  if (!weightLbs) return null;
  if (weightLbs <= 20) return "small";
  if (weightLbs <= 50) return "medium";
  if (weightLbs <= 90) return "large";
  return "xlarge";
}

// Just what the visit form needs to know about a menu item.
export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  pricing: ServicePricing;
  price: number | null;
  sizePrices: Record<PetSize, number | null>;
  durationMinutes: number | null;
};

export const toMenuItem = (s: ServiceRow): MenuItem => ({
  id: s.id,
  name: s.name,
  description: s.description,
  pricing: s.pricing,
  price: s.price_cents,
  sizePrices: { small: s.small_price_cents, medium: s.medium_price_cents, large: s.large_price_cents, xlarge: s.xlarge_price_cents },
  durationMinutes: s.duration_minutes,
});

// The menu price for a pet of this size, or null if the size isn't known.
export const menuPrice = (item: MenuItem, size: PetSize | null | "") =>
  item.pricing === "flat" ? item.price : size ? item.sizePrices[size] : null;

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeDollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// 4550 → "$45.50", 4500 → "$45"
export const money = (cents: number) => (cents % 100 === 0 ? wholeDollars : dollars).format(cents / 100);

// For price inputs: 4550 → "45.50", 4500 → "45"
export const moneyInput = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);

// "45", "45.5", "$1,045.50" → cents. Blank → null. Anything else → NaN.
export function parseMoney(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (cleaned === "") return null;
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

export function priceSummary(item: MenuItem) {
  if (item.pricing === "flat") return item.price === null ? "No price" : money(item.price);
  const prices = PET_SIZES.map((s) => item.sizePrices[s]).filter((p): p is number => p !== null);
  if (prices.length === 0) return "No price";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? money(low) : `${money(low)} to ${money(high)}`;
}

export const durationLabel = (minutes: number | null) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};
