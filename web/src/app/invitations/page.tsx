import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { InvitationList } from "@/components/invitation-list";
import { getMyInvitations, requireUser } from "@/lib/dal";
import { shortDate } from "@/lib/format";
import { AuthFrame } from "../(auth)/auth-frame";

export const metadata: Metadata = { title: "Your invitations | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function InvitationsPage() {
  const user = await requireUser();
  const invitations = await getMyInvitations();

  return (
    <AuthFrame
      eyebrow="YOUR INVITATIONS"
      title="You're"
      accent="invited."
      lede="Accept to join the business with the role and locations they chose for you."
    >
      {invitations.length > 0 ? (
        <InvitationList invitations={invitations.map((i) => ({ ...i, expiresLabel: shortDate(i.expiresAt) }))} />
      ) : (
        <div className="auth-panel">
          <Info size={18} />
          <p>No open invitations for {user.email}. If you were expecting one, check that it was sent to this email address, or ask for a new one.</p>
        </div>
      )}
      <p className="auth-switch"><Link href="/">Back to Grooming Desk</Link></p>
    </AuthFrame>
  );
}
