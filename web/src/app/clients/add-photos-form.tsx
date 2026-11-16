"use client";

import { useActionState } from "react";
import { CircleAlert, Upload } from "lucide-react";
import { PhotoInput } from "@/components/photo-input";
import { addVisitPhotos, type PhotoFormState } from "./visit-actions";

type Props = { clientId: string; petId: string; visitId: string };

export function AddPhotosForm({ clientId, petId, visitId }: Props) {
  const [state, formAction, pending] = useActionState<PhotoFormState, FormData>(addVisitPhotos, undefined);

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="petId" value={petId} />
      <input type="hidden" name="visitId" value={visitId} />
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <div className="field" role="radiogroup" aria-labelledby="photo-kind-label">
        <span id="photo-kind-label">These are</span>
        <div className="choice-row">
          {([["before", "Before"], ["after", "After"], ["other", "Other"]] as const).map(([value, label]) => (
            <label key={value} className="choice-chip">
              <input type="radio" name="kind" value={value} defaultChecked={value === "after"} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <PhotoInput id="add-photos" name="photos" label="Photos" />

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Uploading…" : <><Upload size={15} /> Add photos</>}
      </button>
    </form>
  );
}
