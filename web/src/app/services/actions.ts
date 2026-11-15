"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, required, snapshot, text } from "@/lib/form-fields";
import { canManageServices } from "@/lib/roles";
import { PET_SIZES, SIZE_LABELS, parseMoney, type PetSize } from "@/lib/service-labels";
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

export async function saveService(_prev: ServiceFormState, fd: FormData): Promise<ServiceFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  const serviceId = text(fd, "serviceId");
  let row;

  try {
    if (!canManageServices(workspace.role)) throw new Invalid("Only owners, admins and managers can change the service menu.");
    if (serviceId && !UUID_PATTERN.test(serviceId)) throw new Invalid("That service isn't valid.");
    row = parseService(fd);
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();

  if (serviceId) {
    const { data, error } = await supabase.from("services").update(row)
      .eq("id", serviceId).eq("organization_id", workspace.organizationId).select("id");
    if (error) return { error: error.code === "23505" ? DUPLICATE : userMessage(error), values };
    if (data.length === 0) return { error: "That service couldn't be updated. It may have been removed from your menu.", values };
    redirect("/services?saved=1");
  }

  const { error } = await supabase.from("services").insert({ ...row, organization_id: workspace.organizationId });
  if (error) return { error: error.code === "23505" ? DUPLICATE : userMessage(error), values };
  redirect("/services?added=1");
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
