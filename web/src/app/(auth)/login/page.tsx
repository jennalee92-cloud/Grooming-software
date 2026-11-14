import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { logIn } from "../actions";
import { AuthForm } from "../auth-form";
import { AuthFrame } from "../auth-frame";

export const metadata: Metadata = { title: "Log in | Grooming Desk" };

const NOTICES: Record<string, string> = {
  confirm: "That confirmation link has expired or was opened in a different browser. Log in, or sign up again to get a new link.",
};

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  const notice = typeof error === "string" ? NOTICES[error] : undefined;

  return (
    <AuthFrame
      eyebrow="WELCOME BACK"
      title="Log in to"
      accent="your salon."
      lede="Pick up where your team left off."
    >
      <AuthForm mode="login" action={logIn} notice={notice} />
    </AuthFrame>
  );
}
