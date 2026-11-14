import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthFrame } from "../auth-frame";

export const metadata: Metadata = { title: "Check your email | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email } = await searchParams;
  const address = typeof email === "string" && email.length <= 254 ? email : null;

  return (
    <AuthFrame
      eyebrow="ONE MORE STEP"
      title="Check your"
      accent="email."
      lede={address
        ? `We sent a confirmation link to ${address}. Click it to finish creating your account.`
        : "We sent you a confirmation link. Click it to finish creating your account."}
    >
      <div className="auth-panel">
        <MailCheck size={20} />
        <p>Open the link in this same browser. It can take a minute to arrive, so check your spam folder too.</p>
      </div>
      <p className="auth-switch">Already confirmed? <Link href="/login">Log in</Link></p>
    </AuthFrame>
  );
}
