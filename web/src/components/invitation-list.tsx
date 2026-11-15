"use client";

import { useActionState } from "react";
import { ArrowRight, CircleAlert, MailOpen } from "lucide-react";
import { respondToInvitation, type InvitationResponseState } from "@/app/invitations/actions";
import { ROLE_LABELS, type MemberRole } from "@/lib/roles";

export type InvitationView = {
  id: string;
  organizationName: string;
  role: MemberRole;
  invitedByName: string | null;
  expiresLabel: string;
};

function InvitationCard({ invitation }: { invitation: InvitationView }) {
  const [state, formAction, pending] = useActionState<InvitationResponseState, FormData>(respondToInvitation, undefined);

  return (
    <form action={formAction} className="invite-card">
      <input type="hidden" name="invitationId" value={invitation.id} />
      <div className="invite-card-head">
        <span className="invite-card-icon"><MailOpen size={18} /></span>
        <div>
          <strong>{invitation.organizationName}</strong>
          <small>
            Join as {ROLE_LABELS[invitation.role]}
            {invitation.invitedByName ? ` · invited by ${invitation.invitedByName}` : ""}
            {` · open until ${invitation.expiresLabel}`}
          </small>
        </div>
      </div>
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}
      <div className="invite-card-actions">
        <button type="submit" name="intent" value="accept" className="button-primary" disabled={pending}>
          {pending ? "Working…" : "Accept and join"} {!pending && <ArrowRight size={15} />}
        </button>
        <button type="submit" name="intent" value="decline" className="link-button" disabled={pending}>Decline</button>
      </div>
    </form>
  );
}

export function InvitationList({ invitations }: { invitations: InvitationView[] }) {
  return (
    <div className="invite-list">
      {invitations.map((i) => <InvitationCard key={i.id} invitation={i} />)}
    </div>
  );
}
