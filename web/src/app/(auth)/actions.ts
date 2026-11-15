"use server";

import { redirect } from "next/navigation";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; email?: string } | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Invited staff go straight to their invitation; owners go to business setup.
  const invited = formData.get("invited") === "1";
  const landing = invited ? "/invitations" : "/onboarding";

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email address.", email };
  if (password.length < MIN_PASSWORD) {
    return { error: `Use a password with at least ${MIN_PASSWORD} characters.`, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${landing}` },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { error: "Too many sign-up emails were sent recently. Wait a few minutes and try again.", email };
    }
    if (error.code === "weak_password") {
      return { error: "That password is too easy to guess. Try a longer one.", email };
    }
    return { error: error.message, email };
  }

  // Email confirmation turned off in Supabase: the user is already signed in.
  if (data.session) redirect(landing);

  redirect(`/check-email?email=${encodeURIComponent(email)}${invited ? "&invited=1" : ""}`);
}

export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Check your inbox for the link we sent.", email };
    }
    if (error.code === "invalid_credentials") {
      return { error: "That email and password don't match. Check them and try again.", email };
    }
    return { error: error.message, email };
  }

  redirect("/");
}

// Logs out, then goes to /login, or back to an invitation link if the form
// says so (only sign-up links are allowed, so this can't redirect elsewhere).
export async function logOut(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const next = String(formData?.get("next") ?? "");
  redirect(/^\/signup\?email=[^/\\]*$/.test(next) ? next : "/login");
}
