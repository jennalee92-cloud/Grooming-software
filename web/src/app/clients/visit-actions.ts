"use server";

import { redirect } from "next/navigation";
import type { VisitBehavior } from "@/lib/client-labels";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, pastDate, snapshot, text, weightLbs } from "@/lib/form-fields";
import { MAX_EXTRAS, PET_SIZES, parseMoney, type PetSize } from "@/lib/service-labels";
import { createClient } from "@/lib/supabase/server";

export type VisitFormState = { error?: string; values?: Record<string, string> } | undefined;

const BEHAVIORS: VisitBehavior[] = ["great", "good", "some_trouble", "difficult"];

type Line = { service_id?: string; name?: string; price_cents: number | null };

function money(raw: string, label: string) {
  const cents = parseMoney(raw);
  if (cents !== null && (Number.isNaN(cents) || cents > 10_000_000)) {
    throw new Invalid(`Enter the price for ${label} in dollars, for example 45 or 45.50.`);
  }
  return cents;
}

// Menu items are sent as svc_<id>=on with an optional price_<id> (blank
// means the menu price); extra charges as extraName_<n> / extraPrice_<n>.
function parseLines(fd: FormData): Line[] {
  const lines: Line[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith("svc_") || value !== "on") continue;
    const id = key.slice(4);
    if (!UUID_PATTERN.test(id)) throw new Invalid("Choose services from the menu.");
    lines.push({ service_id: id, price_cents: money(text(fd, `price_${id}`), "each service") });
  }
  for (let n = 0; n < MAX_EXTRAS; n++) {
    const name = text(fd, `extraName_${n}`);
    const price = text(fd, `extraPrice_${n}`);
    if (!name && !price) continue;
    if (!name || !price) throw new Invalid("Give each extra charge a name and a price, or clear it.");
    if (name.length > 80) throw new Invalid("Keep each extra charge's name under 80 characters.");
    lines.push({ name, price_cents: money(price, name) });
  }
  return lines;
}

// Records a new visit, or a correction of an existing one. Visits are never
// edited in place: a correction is a new version with a reason.
export async function saveVisit(_prev: VisitFormState, fd: FormData): Promise<VisitFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  const clientId = text(fd, "clientId");
  const petId = text(fd, "petId");
  const correctsVisitId = text(fd, "correctsVisitId");
  const removing = correctsVisitId !== "" && fd.get("remove") === "on";

  let args;
  try {
    if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId) || (correctsVisitId && !UUID_PATTERN.test(correctsVisitId))) {
      throw new Invalid("That visit isn't valid.");
    }

    const locationId = text(fd, "locationId");
    if (!workspace.locations.some((l) => l.id === locationId)) throw new Invalid("Choose the location where the visit happened.");

    const groomer = text(fd, "groomerMemberId");
    if (groomer && !UUID_PATTERN.test(groomer)) throw new Invalid("Choose who did the groom from the list.");

    const behavior = text(fd, "behavior");
    const size = text(fd, "petSize");
    const reason = correctsVisitId ? optional(fd, "correctionReason", 500, "the reason") : null;
    if (correctsVisitId && !reason) throw new Invalid("Say briefly why this visit is being corrected.");

    const lines = removing ? [] : parseLines(fd);
    if (lines.length > 30) throw new Invalid("A visit can have at most 30 services and charges.");

    args = {
      p_organization_id: workspace.organizationId,
      p_pet_id: petId,
      p_location_id: locationId,
      p_visited_on: pastDate(text(fd, "visitedOn"), "1990-01-01", "Enter the visit date. It can't be in the future."),
      p_groomer_member_id: groomer || undefined,
      p_pet_size: PET_SIZES.includes(size as PetSize) ? (size as PetSize) : undefined,
      p_services: optional(fd, "services", 300, "the services") ?? undefined,
      p_cut_details: optional(fd, "cutDetails", 2000, "the cut details") ?? undefined,
      p_behavior: BEHAVIORS.includes(behavior as VisitBehavior) ? (behavior as VisitBehavior) : undefined,
      p_weight_lbs: weightLbs(fd, "weightLbs") ?? undefined,
      p_notes: optional(fd, "notes", 4000, "the notes") ?? undefined,
      p_corrects_visit_id: correctsVisitId || undefined,
      p_correction_reason: reason ?? undefined,
      p_voided: removing,
      p_lines: lines,
    };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_visit", args);
  if (error) {
    if (error.code === "23505") return { error: "Someone else corrected this visit a moment ago. Go back to the pet's history to see the latest version.", values };
    return { error: userMessage(error), values };
  }

  const outcome = removing ? "removed" : correctsVisitId ? "corrected" : "added";
  redirect(`/clients/${clientId}/pets/${petId}?visit=${outcome}#history`);
}
