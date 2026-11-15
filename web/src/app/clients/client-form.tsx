"use client";

import { useActionState } from "react";
import { CircleAlert, Dog } from "lucide-react";
import { CONTACT_LABELS, SPECIES_LABELS, type ContactMethod, type PetSpecies } from "@/lib/client-labels";
import { saveClient, type FormState } from "./actions";
import { RabiesFields } from "./rabies-fields";

type Props = {
  clientId?: string;
  locations: { id: string; name: string }[];
  defaults?: Record<string, string>;
  today?: string; // needed when adding a new client
};

export function ClientForm({ clientId, locations, defaults = {}, today = "" }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveClient, undefined);
  const v = state?.values ?? defaults;
  const isNew = !clientId;

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <div className="field-row">
        <label className="field" htmlFor="client-first">
          <span>First name</span>
          <input id="client-first" name="firstName" required maxLength={80} autoComplete="off" defaultValue={v.firstName} />
        </label>
        <label className="field" htmlFor="client-last">
          <span>Last name</span>
          <input id="client-last" name="lastName" maxLength={80} autoComplete="off" defaultValue={v.lastName} />
        </label>
      </div>

      <div className="field-row">
        <label className="field" htmlFor="client-phone">
          <span>Phone</span>
          <input id="client-phone" name="phone" type="tel" maxLength={40} autoComplete="off" defaultValue={v.phone} />
        </label>
        <label className="field" htmlFor="client-alt-phone">
          <span>Second phone <em className="optional">optional</em></span>
          <input id="client-alt-phone" name="altPhone" type="tel" maxLength={40} autoComplete="off" defaultValue={v.altPhone} />
        </label>
      </div>

      <div className="field-row">
        <label className="field" htmlFor="client-email">
          <span>Email</span>
          <input id="client-email" name="email" type="email" maxLength={254} autoComplete="off" defaultValue={v.email} />
        </label>
        <label className="field" htmlFor="client-contact">
          <span>Prefers</span>
          <select id="client-contact" name="preferredContact" defaultValue={v.preferredContact ?? ""}>
            <option value="">No preference</option>
            {(Object.keys(CONTACT_LABELS) as ContactMethod[]).map((c) => <option key={c} value={c}>{CONTACT_LABELS[c]}</option>)}
          </select>
        </label>
      </div>

      {locations.length > 1 && (
        <label className="field" htmlFor="client-home">
          <span>Usual location</span>
          <select id="client-home" name="homeLocationId" defaultValue={v.homeLocationId ?? ""}>
            <option value="">Any location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}

      <label className="field" htmlFor="client-address">
        <span>Address <em className="optional">optional</em></span>
        <input id="client-address" name="address" maxLength={300} autoComplete="off" defaultValue={v.address} />
      </label>

      <label className="field" htmlFor="client-emergency">
        <span>Emergency contact <em className="optional">optional</em></span>
        <input id="client-emergency" name="emergencyContact" maxLength={200} autoComplete="off" defaultValue={v.emergencyContact}
          placeholder="Name and phone" />
      </label>

      <label className="field" htmlFor="client-notes">
        <span>Notes <em className="optional">optional</em></span>
        <textarea id="client-notes" name="notes" maxLength={4000} rows={3} defaultValue={v.notes}
          placeholder="Pickup arrangements, payment notes, anything the team should know" />
      </label>

      {isNew && (
        <fieldset className="form-section">
          <legend><Dog size={15} /> First pet <em className="optional">optional, you can add more after</em></legend>
          <div className="field-row">
            <label className="field" htmlFor="pet-name">
              <span>Pet&apos;s name</span>
              <input id="pet-name" name="petName" maxLength={80} autoComplete="off" defaultValue={v.petName} />
            </label>
            <label className="field" htmlFor="pet-species">
              <span>Species</span>
              <select id="pet-species" name="petSpecies" defaultValue={v.petSpecies ?? "dog"}>
                {(Object.keys(SPECIES_LABELS) as PetSpecies[]).map((s) => <option key={s} value={s}>{SPECIES_LABELS[s]}</option>)}
              </select>
            </label>
          </div>
          <label className="field" htmlFor="pet-breed">
            <span>Breed</span>
            <input id="pet-breed" name="petBreed" maxLength={80} autoComplete="off" defaultValue={v.petBreed} />
          </label>
        </fieldset>
      )}
      {isNew && <RabiesFields values={v} today={today} />}

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : isNew ? "Add client" : "Save changes"}
      </button>
    </form>
  );
}
