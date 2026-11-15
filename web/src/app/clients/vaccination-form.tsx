"use client";

import { useActionState, useState } from "react";
import { CircleAlert, ShieldCheck, Syringe } from "lucide-react";
import { saveVaccination, type VaccinationFormState } from "./vaccination-actions";

type Props = {
  clientId: string;
  petId: string;
  vaccinationId?: string;
  suggestions: string[];
  today: string;
  defaults: Record<string, string>;
};

// YYYY-MM-DD plus whole years, keeping the same calendar day.
function plusYears(day: string, years: number) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  return date.toISOString().slice(0, 10);
}

export function VaccinationForm({ clientId, petId, vaccinationId, suggestions, today, defaults }: Props) {
  const [state, formAction, pending] = useActionState<VaccinationFormState, FormData>(saveVaccination, undefined);
  const v = state?.values ?? defaults;
  const [givenOn, setGivenOn] = useState(v.givenOn ?? "");
  const [expiresOn, setExpiresOn] = useState(v.expiresOn ?? "");

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="petId" value={petId} />
      {vaccinationId && <input type="hidden" name="vaccinationId" value={vaccinationId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <fieldset className="form-section form-section-first">
        <legend><Syringe size={15} /> The vaccine</legend>
        <label className="field" htmlFor="vax-name">
          <span>Vaccine</span>
          <input id="vax-name" name="vaccine" list="vax-suggestions" maxLength={80} required autoComplete="off" defaultValue={v.vaccine}
            placeholder="Start typing, or pick from the list" />
          <datalist id="vax-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>

        <div className="field-row">
          <label className="field" htmlFor="vax-given">
            <span>Date given <em className="field-optional">if known</em></span>
            <input id="vax-given" name="givenOn" type="date" min="1990-01-01" max={today} value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
          </label>
          <label className="field" htmlFor="vax-expires">
            <span>Expires</span>
            <input id="vax-expires" name="expiresOn" type="date" required min="1990-01-01" max="2100-12-31" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          </label>
        </div>
        <div className="quick-dates">
          <small>Expires after</small>
          {[1, 3].map((years) => (
            <button key={years} type="button" className="button-quiet" disabled={!givenOn}
              onClick={() => setExpiresOn(plusYears(givenOn, years))}>
              {years} {years === 1 ? "year" : "years"}
            </button>
          ))}
          {!givenOn && <small>(enter the date given first)</small>}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend><ShieldCheck size={15} /> Proof</legend>
        <label className="check-option check-option-strong">
          <input type="checkbox" name="verified" defaultChecked={v.verified === "on"} />
          <span>We&apos;ve seen proof from the vet (certificate, invoice or vet portal)</span>
        </label>
        <label className="field" htmlFor="vax-notes">
          <span>Notes <em className="field-optional">optional</em></span>
          <textarea id="vax-notes" name="notes" maxLength={500} rows={2} defaultValue={v.notes}
            placeholder="Vet clinic, tag number, or anything else worth keeping" />
        </label>
      </fieldset>

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : vaccinationId ? "Save changes" : "Add vaccination"}
      </button>
    </form>
  );
}
