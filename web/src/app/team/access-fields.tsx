"use client";

import { useState } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type MemberRole } from "@/lib/roles";

type Props = {
  idPrefix: string;
  roles: MemberRole[];
  locations: { id: string; name: string }[];
  defaultRole?: string;
  defaultAllLocations?: boolean;
  defaultLocationIds?: string[];
};

// Role picker plus "which locations can they see". Admins always see
// every location, so the location choice is hidden for them.
export function AccessFields({ idPrefix, roles, locations, defaultRole, defaultAllLocations, defaultLocationIds }: Props) {
  const [role, setRole] = useState(defaultRole && roles.includes(defaultRole as MemberRole) ? defaultRole : "groomer");
  const [allLocations, setAllLocations] = useState(defaultAllLocations ?? locations.length === 1);
  const isAdmin = role === "admin";

  return (
    <>
      <label className="field" htmlFor={`${idPrefix}-role`}>
        <span>Role</span>
        <select id={`${idPrefix}-role`} name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <small>{ROLE_DESCRIPTIONS[role as MemberRole]}</small>
      </label>

      <fieldset className="field location-picker" disabled={isAdmin}>
        <legend>Locations</legend>
        {isAdmin ? (
          <small>Admins work across every location.</small>
        ) : (
          <>
            <label className="check-option check-option-strong">
              <input type="checkbox" name="allLocations" checked={allLocations} onChange={(e) => setAllLocations(e.target.checked)} />
              <span>All locations, including ones you add later</span>
            </label>
            {!allLocations && (
              <div className="check-grid">
                {locations.map((l) => (
                  <label key={l.id} className="check-option">
                    <input type="checkbox" name="locationIds" value={l.id} defaultChecked={defaultLocationIds?.includes(l.id)} />
                    <span>{l.name}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </fieldset>
    </>
  );
}
