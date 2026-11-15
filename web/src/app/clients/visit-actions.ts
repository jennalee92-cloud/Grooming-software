"use server";

import { redirect } from "next/navigation";
import type { VisitBehavior } from "@/lib/client-labels";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN, userMessage } from "@/lib/db-errors";
import { Invalid, optional, pastDate, snapshot, text, weightLbs } from "@/lib/form-fields";
import { createClient } from "@/lib/supabase/server";

export type VisitFormState = { error?: string; values?: Record<string, string> } | undefined;

const BEHAVIORS: VisitBehavior[] = ["great", "good", "some_trouble", "difficult"];

// Records a new visit, or a correction of an existing one. Visits are never
// edited in place: a correction is a new version with a reason.
export async function saveVisit(_prev: VisitFormState, fd: FormData): Promise<VisitFormState> {
  const values = snapshot(fd);
  const workspace = await requireWorkspace();
  const clientId = text(fd, "clientId");
  const petId = text(fd, "petId");
  const correctsVisitId = text(fd, "correctsVisitId");
  const removing = correctsVisitId !== "" && fd.get("remove") === "on";

  let row;
  try {
    if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId) || (correctsVisitId && !UUID_PATTERN.test(correctsVisitId))) {
      throw new Invalid("That visit isn't valid.");
    }

    const locationId = text(fd, "locationId");
    if (!workspace.locations.some((l) => l.id === locationId)) throw new Invalid("Choose the location where the visit happened.");

    const groomer = text(fd, "groomerMemberId");
    if (groomer && !UUID_PATTERN.test(groomer)) throw new Invalid("Choose who did the groom from the list.");

    const behavior = text(fd, "behavior");
    const reason = correctsVisitId ? optional(fd, "correctionReason", 500, "the reason") : null;
    if (correctsVisitId && !reason) throw new Invalid("Say briefly why this visit is being corrected.");

    row = {
      organization_id: workspace.organizationId,
      pet_id: petId,
      location_id: locationId,
      visited_on: pastDate(text(fd, "visitedOn"), "1990-01-01", "Enter the visit date. It can't be in the future."),
      groomer_member_id: groomer || null,
      services: optional(fd, "services", 300, "the services"),
      cut_details: optional(fd, "cutDetails", 2000, "the cut details"),
      behavior: BEHAVIORS.includes(behavior as VisitBehavior) ? (behavior as VisitBehavior) : null,
      weight_lbs: weightLbs(fd, "weightLbs"),
      notes: optional(fd, "notes", 4000, "the notes"),
      corrects_visit_id: correctsVisitId || null,
      correction_reason: reason,
      voided: removing,
    };
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message, values };
    throw e;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("grooming_visits").insert(row);
  if (error) {
    if (error.code === "23505") return { error: "Someone else corrected this visit a moment ago. Go back to the pet's history to see the latest version.", values };
    return { error: userMessage(error), values };
  }

  const outcome = removing ? "removed" : correctsVisitId ? "corrected" : "added";
  redirect(`/clients/${clientId}/pets/${petId}?visit=${outcome}#history`);
}
