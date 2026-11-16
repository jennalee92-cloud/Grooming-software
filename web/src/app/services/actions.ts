"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, required, snapshot, text } from "@/lib/form-fields";
import { canManageServices } from "@/lib/roles";
import { MAX_BREED_PRICES, PET_SIZES, SIZE_LABELS, breedKey, parseMoney, type BreedPrice, type PetSize } from "@/lib/service-labels";
import { createClient } from "@/lib/supabase/server";

export type ServiceFormState = { error?: string; values?: Record<string, string> } | undefined;
export type ActionState = { error?: string } | undefined;

const DUPLICATE = "There's already a service with that name on your menu. Use a different name, or edit the existing one.";

function price(fd: FormData, name: string, label: string) {
  const cents = parseMoney(text(fd, name));
  if (cents === null) throw new Invalid(`Enter a price for ${label}.`);
  if (Number.isNaN(cents) || cents > 10_000_000) throw new Invalid(`Enter the price for ${label} in dollars, for example 45 or 45.50.`);
  return cents;
}

function parseService(fd: FormData) {
  const name = required(fd, "name", 80, "the service name");
  const bySize = text(fd, "pricing") === "by_size";

  const rawDuration = text(fd, "durationMinutes");
  const duration = rawDuration === "" ? null : Number(rawDuration);
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 720)) {
    throw new Invalid("Enter the time in minutes, between 5 and 720, or leave it blank.");
  }

  const sizePrice = (size: PetSize) => (bySize ? price(fd, `${size}Price`, `${SIZE_LABELS[size].toLowerCase()} pets`) : null);

  return {
    name,
    description: optional(fd, "description", 500, "the description"),
    pricing: bySize ? ("by_size" as const) : ("flat" as const),
    price_cents: bySize ? null : price(fd, "price", name),
    small_price_cents: sizePrice(PET_SIZES[0]),
    medium_price_cents: sizePrice(PET_SIZES[1]),
    large_price_cents: sizePrice(PET_SIZES[2]),
    xlarge_price_cents: sizePrice(PET_SIZES[3]),
    duration_minutes: duration,
  };
}

// Breed rows arrive as breed_<n> / breedPrice_<n>; blank rows are skipped.
function parseBreedPrices(fd: FormData): BreedPrice[] {
  const prices: BreedPrice[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < MAX_BREED_PRICES; n++) {
    const breed = text(fd, `breed_${n}`);
    const raw = text(fd, `breedPrice_${n}`);
    if (!breed && !raw) continue;
    if (!breed) throw new Invalid("Choose a breed for each breed price, or remove the empty row.");
    if (breed.length > 80) throw new Invalid("Keep each breed name under 80 characters.");
    if (seen.has(breedKey(breed))) throw new Invalid(`${breed} is listed twice. Keep one price per breed.`);
    seen.add(breedKey(breed));
    prices.push({ breed, price_cents: price(fd, `breedPrice_${n}`, breed) });
  }
  return prices;
}

export async function saveService(_prev: ServiceFormState, fd: FormData): Promise<ServiceFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  const serviceId = text(fd, "serviceId");
  let row;
  let breedPrices: BreedPrice[];

  try {
    if (!canManageServices(workspace.role)) throw new Invalid("Only owners, admins and managers can change the service menu.");
    if (serviceId && !UUID_PATTERN.test(serviceId)) throw new Invalid("That service isn't valid.");
    row = parseService(fd);
    breedPrices = parseBreedPrices(fd);
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();
  let savedId = serviceId;

  if (serviceId) {
    const { data, error } = await supabase.from("services").update(row)
      .eq("id", serviceId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: error.code === "23505" ? DUPLICATE : userMessage(error), values };
    if (data.length === 0) return { error: "That service couldn't be updated. It may have been removed from your menu.", values };
  } else {
    const { data, error } = await supabase.from("services")
      .insert({ ...row, organization_id: workspace.organizationId }).select("id").single();
    if (error) return { error: error.code === "23505" ? DUPLICATE : userMessage(error), values };
    savedId = data.id;
  }

  const breeds = await supabase.rpc("set_service_breed_prices", { p_service_id: savedId, p_prices: breedPrices });
  if (breeds.error) {
    // The service itself saved; send them to its edit page to fix the breed prices.
    if (!serviceId) redirect(`/services/${savedId}/edit?breedError=1`);
    return { error: userMessage(breeds.error), values };
  }

  redirect(serviceId ? "/services?saved=1" : "/services?added=1");
}

export async function setServiceRetired(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const workspace = await requireWorkspace();
  if (!canManageServices(workspace.role)) return { error: "Only owners, admins and managers can change the service menu." };
  const serviceId = text(fd, "serviceId");
  if (!UUID_PATTERN.test(serviceId)) return { error: "That service isn't valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("services")
    .update({ retired_at: fd.get("retired") === "true" ? new Date().toISOString() : null })
    .eq("id", serviceId).eq("organization_id", workspace.organizationId).select("id");
  if (error) {
    return { error: error.code === "23505" ? "A current service already has this name. Rename one of them first." : userMessage(error) };
  }
  if (data.length === 0) return { error: "That service couldn't be changed." };
  refresh();
  return undefined;
}
