import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthFrame } from "../auth-frame";

export const metadata: Metadata = { title: "Create your account | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <AuthFrame
      eyebrow="START YOUR WORKSPACE"
      title="Create your"
      accent="account."
      lede="You'll confirm your email, then set up your business and first location. Staff accounts come later, by invitation."
    >
      <AuthForm mode="signup" action={signUp} />
    </AuthFrame>
  );
}
