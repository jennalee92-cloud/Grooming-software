"use client";

import { useActionState } from "react";
import { Camera, CircleAlert, Upload } from "lucide-react";
import { uploadVetRecord, type VaccinationFormState } from "./vaccination-actions";

type Props = {
  clientId: string;
  petId: string;
  vaccines: { id: string; label: string }[];
  defaultLink?: string;
};

export function VetRecordUploadForm({ clientId, petId, vaccines, defaultLink = "" }: Props) {
  const [state, formAction, pending] = useActionState<VaccinationFormState, FormData>(uploadVetRecord, undefined);

  return (
    <form action={formAction} className="auth-form record-form" noValidate>
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="petId" value={petId} />
      {state?.error && <p className="form-error" role="alert"><CircleAlert size={16} /> {state.error}</p>}

      <label className="field" htmlFor="vet-file">
        <span><Camera size={13} /> Photo or PDF</span>
        <input id="vet-file" name="proof" type="file" required className="file-input"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" />
        <small>Up to 10 MB. On a phone you can take the photo right now.</small>
      </label>

      {vaccines.length > 0 && (
        <label className="field" htmlFor="vet-link">
          <span>Which vaccine is this for? <em className="field-optional">optional</em></span>
          <select id="vet-link" name="linkVaccinationId" defaultValue={defaultLink}>
            <option value="">Several, or not sure</option>
            {vaccines.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <small>Linking it marks that vaccine as proof seen.</small>
        </label>
      )}

      <button type="submit" className="button-primary invite-submit" disabled={pending}>
        {pending ? "Uploading…" : <><Upload size={15} /> Upload vet record</>}
      </button>
    </form>
  );
}
