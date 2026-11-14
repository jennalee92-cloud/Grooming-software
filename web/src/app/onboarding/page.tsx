import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspaces, requireUser } from "@/lib/dal";
import { AuthFrame } from "../(auth)/auth-frame";
import { logOut } from "../(auth)/actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function OnboardingPage() {
  const user = await requireUser();
  if ((await getWorkspaces()).length > 0) redirect("/");

  const suggestedName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";

  return (
    <AuthFrame
      eyebrow="SET UP YOUR BUSINESS"
      title="Tell us about"
      accent="your salon."
      lede="This creates your private workspace. You'll be its owner, and only people you invite will be able to see it."
    >
      <OnboardingForm suggestedName={suggestedName} />
      <form action={logOut} className="auth-switch">
        Signed in as {user.email}. <button type="submit" className="link-button">Log out</button>
      </form>
    </AuthFrame>
  );
}
