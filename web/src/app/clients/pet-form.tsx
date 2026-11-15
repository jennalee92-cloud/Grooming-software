"use client";

import { useActionState } from "react";
import { CircleAlert, HeartPulse, PawPrint, TriangleAlert } from "lucide-react";
import { SEX_LABELS, SPECIES_LABELS, type PetSex, type PetSpecies } from "@/lib/client-labels";
import { savePet, type FormState } from "./actions";
import { RabiesFields } from "./rabies-fields";

type Props = {
  clientId: string;
  petId?: string;
  defaults?: Record<string, string>;
  today?: string; // needed when adding a new pet
};

export function PetForm({ clientId, petId, defaults = {}, today = "" }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePet, undefined);
  const v = state?.values ?? defaults;

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      <input type="hidden" name="clientId" value={clientId} />
      {petId && <input type="hidden" name="petId" value={petId} />}
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <fieldset className="form-section">
        <legend><PawPrint size={15} /> The basics</legend>
        <div className="field-row">
          <label className="field" htmlFor="pet-name">
            <span>Name</span>
            <input id="pet-name" name="name" required maxLength={80} autoComplete="off" defaultValue={v.name} />
          </label>
          <label className="field" htmlFor="pet-species">
            <span>Species</span>
            <select id="pet-species" name="species" defaultValue={v.species ?? "dog"}>
              {(Object.keys(SPECIES_LABELS) as PetSpecies[]).map((s) => <option key={s} value={s}>{SPECIES_LABELS[s]}</option>)}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field" htmlFor="pet-breed">
            <span>Breed</span>
            <input id="pet-breed" name="breed" maxLength={80} autoComplete="off" defaultValue={v.breed} />
          </label>
          <label className="field" htmlFor="pet-color">
            <span>Color</span>
            <input id="pet-color" name="color" maxLength={80} autoComplete="off" defaultValue={v.color} />
          </label>
        </div>

        <div className="field-row">
          <label className="field" htmlFor="pet-sex">
            <span>Sex</span>
            <select id="pet-sex" name="sex" defaultValue={v.sex ?? "unknown"}>
              {(Object.keys(SEX_LABELS) as PetSex[]).map((s) => <option key={s} value={s}>{SEX_LABELS[s]}</option>)}
            </select>
          </label>
          <label className="field" htmlFor="pet-fixed">
            <span>Spayed or neutered</span>
            <select id="pet-fixed" name="fixed" defaultValue={v.fixed ?? ""}>
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field" htmlFor="pet-birth">
            <span>Birth date <em className="optional">or best guess</em></span>
            <input id="pet-birth" name="birthDate" type="date" min="1980-01-01" defaultValue={v.birthDate} />
          </label>
          <label className="field" htmlFor="pet-weight">
            <span>Weight (lbs)</span>
            <input id="pet-weight" name="weightLbs" type="number" inputMode="decimal" min="0.1" max="399.9" step="0.1" defaultValue={v.weightLbs} />
          </label>
        </div>

        <label className="field" htmlFor="pet-coat">
          <span>Coat</span>
          <input id="pet-coat" name="coat" maxLength={120} autoComplete="off" defaultValue={v.coat}
            placeholder="For example: curly, matting behind ears" />
        </label>
      </fieldset>

      {!petId && <RabiesFields values={v} today={today} />}

      <fieldset className="form-section">
        <legend><HeartPulse size={15} /> Care and handling</legend>

        <label className="check-option check-option-strong check-caution">
          <input type="checkbox" name="handleWithCare" defaultChecked={v.handleWithCare === "on"} />
          <span><TriangleAlert size={15} /> Handle with care: show a warning everywhere this pet appears</span>
        </label>

        <label className="field" htmlFor="pet-temperament">
          <span>Temperament and handling</span>
          <textarea id="pet-temperament" name="temperament" maxLength={1000} rows={2} defaultValue={v.temperament}
            placeholder="For example: nervous with dryers, nips when feet are handled" />
        </label>

        <label className="field" htmlFor="pet-allergies">
          <span>Allergies</span>
          <textarea id="pet-allergies" name="allergies" maxLength={1000} rows={2} defaultValue={v.allergies}
            placeholder="Shampoos, products, foods" />
        </label>

        <label className="field" htmlFor="pet-medical">
          <span>Medical notes</span>
          <textarea id="pet-medical" name="medicalNotes" maxLength={2000} rows={2} defaultValue={v.medicalNotes}
            placeholder="Conditions, medications, vet details" />
        </label>

        <label className="field" htmlFor="pet-grooming">
          <span>Standing grooming instructions</span>
          <textarea id="pet-grooming" name="groomingInstructions" maxLength={4000} rows={4} defaultValue={v.groomingInstructions}
            placeholder="The usual cut, blade lengths, face and feet style" />
        </label>
      </fieldset>

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Saving…" : petId ? "Save changes" : "Add pet"}
      </button>
    </form>
  );
}
