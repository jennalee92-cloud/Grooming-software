import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { logOut, signUp } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthFrame } from "../auth-frame";

export const metadata: Metadata = { title: "Create your account | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { email } = await searchParams;
  // Invitation links carry the invited email.
  const invitedEmail = typeof email === "string" && email.length <= 254 ? email : undefined;

  const user = await getCurrentUser();
  if (user) {
    // Invited email matches who's signed in: the invitation is waiting for them.
    if (!invitedEmail || invitedEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
      redirect(invitedEmail ? "/invitations" : "/");
    }
    // Someone else is signed in on this browser (common when testing, or a shared front-desk computer).
    return (
      <AuthFrame eyebrow="YOU'VE BEEN INVITED" title="Wrong" accent="account." lede={`This invitation is for ${invitedEmail}, but this browser is signed in as ${user.email}.`}>
        <div className="auth-panel">
          <Info size={18} />
          <p>Log out to create the account for {invitedEmail}, or to log in as them if they already have one. Tip: when testing, open the invite link in a private window instead.</p>
        </div>
        <form action={logOut}>
          <input type="hidden" name="next" value={`/signup?email=${encodeURIComponent(invitedEmail)}`} />
          <button type="submit" className="button-primary button-block">Log out and continue</button>
        </form>
        <p className="auth-switch"><Link href="/">Stay signed in as {user.email}</Link></p>
      </AuthFrame>
    );
  }

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
