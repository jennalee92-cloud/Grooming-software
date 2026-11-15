"use client";

import { useActionState } from "react";
import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import type { MemberRole } from "@/lib/roles";
import { AccessFields } from "./access-fields";
import { inviteStaff, type InviteState } from "./actions";

type Props = {
  roles: MemberRole[];
  locations: { id: string; name: string }[];
};

export function InviteForm({ roles, locations }: Props) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteStaff, undefined);
  const v = state?.values;

  return (
    <div className="invite-form-wrap">
      {state?.sent && (
        <div className="invite-sent" role="status">
          <CircleCheck size={18} />
          <div>
            <strong>Invitation ready for {state.sent.email}.</strong>
            <p>Grooming Desk doesn&apos;t email invitations yet, so send them this link yourself. They create an account with that email, and the invitation is waiting once they confirm it.</p>
            <div className="invite-link-row">
              <code>{state.sent.link}</code>
              <CopyButton text={state.sent.link} />
            </div>
          </div>
        </div>
      )}

      {/* A new key after each invitation clears the form for the next one. */}
      <form key={state?.sent?.email ?? "invite"} action={formAction} className="auth-form" noValidate>
        {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

        <div className="field-row">
          <label className="field" htmlFor="invite-email">
            <span>Email</span>
            <input id="invite-email" name="email" type="email" required autoComplete="off"
              defaultValue={v?.email} placeholder="teammate@example.com" />
          </label>
          <label className="field" htmlFor="invite-name">
            <span>Name <em className="optional">optional</em></span>
            <input id="invite-name" name="displayName" maxLength={120} autoComplete="off"
              defaultValue={v?.displayName} placeholder="How the team knows them" />
          </label>
        </div>

        <AccessFields
          idPrefix="invite"
          roles={roles}
          locations={locations}
          defaultRole={v?.role}
          defaultAllLocations={v?.allLocations}
          defaultLocationIds={v?.locationIds}
        />

        <button type="submit" className="button-primary invite-submit" disabled={pending}>
          {pending ? "Creating…" : <>Create invitation <Send size={15} /></>}
        </button>
      </form>
    </div>
  );
}
