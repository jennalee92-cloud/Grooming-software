import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvitationList } from "@/components/invitation-list";
import { getMyInvitations, getWorkspaces, requireUser } from "@/lib/dal";
import { shortDate } from "@/lib/format";
import { AuthFrame } from "../(auth)/auth-frame";
import { logOut } from "../(auth)/actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function OnboardingPage() {
  const user = await requireUser();
  const [workspaces, invitations] = await Promise.all([getWorkspaces(), getMyInvitations()]);
  if (workspaces.length > 0) redirect("/");

  const suggestedName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  const invited = invitations.length > 0;

  return (
    <AuthFrame
      eyebrow={invited ? "YOU'VE BEEN INVITED" : "SET UP YOUR BUSINESS"}
      title={invited ? "Join" : "Tell us about"}
      accent={invited ? "your team." : "your salon."}
      lede={invited
        ? "Accept an invitation to join a business that already uses Grooming Desk."
        : "This creates your private workspace. You'll be its owner, and only people you invite will be able to see it."}
    >
      {invited && (
        <>
          <InvitationList invitations={invitations.map((i) => ({ ...i, expiresLabel: shortDate(i.expiresAt) }))} />
          <div className="or-divider"><span>or start your own business</span></div>
        </>
      )}
      <OnboardingForm suggestedName={suggestedName} />
      <form action={logOut} className="auth-switch">
        Signed in as {user.email}. <button type="submit" className="link-button">Log out</button>
      </form>
    </AuthFrame>
  );
}
