"use client";

import { useActionState, useState } from "react";
import { CircleAlert, History, Receipt, Scissors } from "lucide-react";
import { BEHAVIOR_LABELS, type VisitBehavior } from "@/lib/client-labels";
import type { MenuItem, PetSize } from "@/lib/service-labels";
import { saveVisit, type VisitFormState } from "./visit-actions";
import { VisitServicesPicker } from "./visit-services-picker";

type Props = {
  clientId: string;
  petId: string;
  correctsVisitId?: string;
  locations: { id: string; name: string }[];
  team: { memberId: string; label: string }[];
  today: string;
  defaults: Record<string, string>;
  menu: MenuItem[];
  suggestedSize: PetSize | null;
  canEditMenu: boolean;
  petBreed: string | null;
};

export function VisitForm({ clientId, petId, correctsVisitId, locations, team, today, defaults, menu, suggestedSize, canEditMenu, petBreed }: Props) {
  const [state, formAction, pending] = useActionState<VisitFormState, FormData>(saveVisit, undefined);
  const v = state?.values ?? defaults;
  const [removing, setRemoving] = useState(v.remove === "on");
  const correcting = Boolean(correctsVisitId);

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="petId" value={petId} />
      {correctsVisitId && <input type="hidden" name="correctsVisitId" value={correctsVisitId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      {correcting && (
        <fieldset className="form-section form-section-first">
          <legend><History size={15} /> Why it&apos;s being corrected</legend>
          <label className="field" htmlFor="visit-reason">
            <span>Reason</span>
            <textarea id="visit-reason" name="correctionReason" maxLength={500} rows={2} required defaultValue={v.correctionReason}
              placeholder="For example: wrong blade length recorded" />
            <small>The original stays in the history. This reason is shown with the correction.</small>
          </label>
          <label className="check-option check-option-strong check-caution">
            <input type="checkbox" name="remove" checked={removing} onChange={(e) => setRemoving(e.target.checked)} />
            <span>This visit shouldn&apos;t be here at all (wrong pet, or entered by mistake)</span>
          </label>
        </fieldset>
      )}

      {/* When removing, the details are kept as they were; only the reason matters. */}
      <fieldset className="form-section" disabled={removing} hidden={removing}>
        <legend><Scissors size={15} /> The visit</legend>
        <div className="field-row">
          <label className="field" htmlFor="visit-date">
            <span>Date</span>
            <input id="visit-date" name="visitedOn" type="date" required min="1990-01-01" max={today} defaultValue={v.visitedOn ?? today} />
          </label>
          <label className="field" htmlFor="visit-location">
            <span>Location</span>
            <select id="visit-location" name="locationId" defaultValue={v.locationId ?? locations[0]?.id}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field" htmlFor="visit-groomer">
            <span>Groomed by</span>
            <select id="visit-groomer" name="groomerMemberId" defaultValue={v.groomerMemberId ?? ""}>
              <option value="">Not recorded</option>
              {team.map((m) => <option key={m.memberId} value={m.memberId}>{m.label}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="visit-weight">
            <span>Weight today (lbs)</span>
            <input id="visit-weight" name="weightLbs" type="number" inputMode="decimal" min="0.1" max="399.9" step="0.1" defaultValue={v.weightLbs} />
          </label>
        </div>

        <div className="field" role="radiogroup" aria-labelledby="visit-behavior-label">
          <span id="visit-behavior-label">How did they do?</span>
          <div className="choice-row">
            {(Object.keys(BEHAVIOR_LABELS) as VisitBehavior[]).map((b) => (
              <label key={b} className={`choice-chip behavior-${b}`}>
                <input type="radio" name="behavior" value={b} defaultChecked={v.behavior === b} />
                <span>{BEHAVIOR_LABELS[b]}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="field" htmlFor="visit-cut">
          <span>Cut details</span>
          <textarea id="visit-cut" name="cutDetails" maxLength={2000} rows={3} defaultValue={v.cutDetails}
            placeholder="Blades, guards, face and feet style, anything to repeat next time" />
        </label>

        <label className="field" htmlFor="visit-notes">
          <span>Notes</span>
          <textarea id="visit-notes" name="notes" maxLength={4000} rows={3} defaultValue={v.notes}
            placeholder="Skin or coat condition, anything you noticed, what to tell the owner" />
        </label>
      </fieldset>

      <fieldset className="form-section" disabled={removing} hidden={removing}>
        <legend><Receipt size={15} /> Services and charges</legend>
        <VisitServicesPicker menu={menu} values={v} suggestedSize={suggestedSize} canEditMenu={canEditMenu} petBreed={petBreed} />
        {/* Visits recorded before the menu existed kept services as text. */}
        {defaults.services && (
          <label className="field" htmlFor="visit-services">
            <span>Services as first written <em className="field-optional">from before the menu</em></span>
            <input id="visit-services" name="services" maxLength={300} autoComplete="off" defaultValue={v.services} />
          </label>
        )}
      </fieldset>

      {/* Removing still sends the original details so the record stays complete. */}
      {removing && (
        <>
          {(["visitedOn", "locationId", "groomerMemberId", "weightLbs", "petSize", "services", "behavior", "cutDetails", "notes"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={defaults[k] ?? ""} />
          ))}
        </>
      )}

      <button type="submit" className={`button-primary invite-submit${removing ? " button-danger" : ""}`} disabled={pending}>
        {pending ? "Saving…" : removing ? "Remove visit" : correcting ? "Save correction" : "Record visit"}
      </button>
    </form>
  );
}
