import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { signUp } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthFrame } from "../auth-frame";

export const metadata: Metadata = { title: "Create your account | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { email } = await searchParams;
  // Invitation links carry the invited email.
  const invitedEmail = typeof email === "string" && email.length <= 254 ? email : undefined;

  if (await getCurrentUser()) redirect(invitedEmail ? "/invitations" : "/");

  return (
    <AuthFrame
      eyebrow={invitedEmail ? "YOU'VE BEEN INVITED" : "START YOUR WORKSPACE"}
      title="Create your"
      accent="account."
      lede={invitedEmail
        ? "Use the email your invitation was sent to. Once you confirm it, your invitation will be waiting."
        : "You'll confirm your email, then set up your business and first location. Staff accounts come later, by invitation."}
    >
      <AuthForm mode="signup" action={signUp} defaultEmail={invitedEmail} />
    </AuthFrame>
  );
}
