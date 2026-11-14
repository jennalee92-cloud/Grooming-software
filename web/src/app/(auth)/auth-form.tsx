"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import type { AuthFormState } from "./actions";

type Props = {
  mode: "login" | "signup";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  notice?: string;
};

export function AuthForm({ mode, action, notice }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="auth-form" noValidate>
      {notice && !state?.error && <p className="form-notice">{notice}</p>}
      {state?.error && (
        <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>
      )}

      <label className="field" htmlFor={`${mode}-email`}>
        <span>Email</span>
        <input
          id={`${mode}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          placeholder="you@yoursalon.com"
        />
      </label>

      <label className="field" htmlFor={`${mode}-password`}>
        <span>Password</span>
        <input
          id={`${mode}-password`}
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
        />
        {isSignup && <small>At least 8 characters.</small>}
      </label>

      <button type="submit" className="button-primary button-block" disabled={pending}>
        {pending ? (isSignup ? "Creating account…" : "Logging in…") : (isSignup ? "Create account" : "Log in")}
        {!pending && <ArrowRight size={16} />}
      </button>

      <p className="auth-switch">
        {isSignup ? (
          <>Already have an account? <Link href="/login">Log in</Link></>
        ) : (
          <>New to Grooming Desk? <Link href="/signup">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
