"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState =
  | { error?: string; values?: { businessName: string; displayName: string; locationName: string; timezone: string } }
  | undefined;

export async function createBusiness(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  await requireUser();

  const values = {
    businessName: String(formData.get("businessName") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim(),
    locationName: String(formData.get("locationName") ?? "").trim(),
    timezone: String(formData.get("timezone") ?? "").trim(),
  };

  if (!values.businessName) return { error: "Enter your business name.", values };
  if (values.businessName.length > 120) return { error: "Keep the business name under 120 characters.", values };
  if (!values.locationName) return { error: "Name your first location, for example the street it's on.", values };
  if (values.locationName.length > 120) return { error: "Keep the location name under 120 characters.", values };
  if (values.displayName.length > 120) return { error: "Keep your name under 120 characters.", values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: values.businessName,
    p_location_name: values.locationName,
    p_timezone: values.timezone || "America/New_York",
    p_display_name: values.displayName || undefined,
  });

  if (error) {
    if (error.message.startsWith("Unknown time zone")) return { error: "Choose a time zone from the list.", values };
    // create_organization raises plain-language messages for its own checks.
    return { error: error.message, values };
  }

  redirect("/");
}
