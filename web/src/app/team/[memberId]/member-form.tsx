"use client";

import { useActionState } from "react";
import { CircleAlert } from "lucide-react";
import type { MemberRole } from "@/lib/roles";
import { AccessFields } from "../access-fields";
import { updateMemberAccess, type ActionState } from "../actions";

type Props = {
  memberId: string;
  roles: MemberRole[];
  locations: { id: string; name: string }[];
  role: MemberRole;
  allLocations: boolean;
  locationIds: string[];
};

export function MemberForm({ memberId, roles, locations, role, allLocations, locationIds }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateMemberAccess, undefined);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <input type="hidden" name="memberId" value={memberId} />
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}
      <AccessFields
        idPrefix="member"
        roles={roles}
        locations={locations}
        defaultRole={role}
        defaultAllLocations={allLocations}
        defaultLocationIds={locationIds}
      />
      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
