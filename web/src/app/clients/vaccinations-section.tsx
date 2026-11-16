import Link from "next/link";
import { Camera, FileText, Paperclip, PencilLine, Plus, ShieldCheck, Syringe, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { shortDate } from "@/lib/format";
import type { PetVaccines } from "@/lib/vaccinations";
import { STATUS_LABELS, vaccineDate } from "@/lib/vaccine-labels";
import type { VetRecord } from "@/lib/vet-records";
import { removeVetRecord } from "./vaccination-actions";

// Warning shown at the top of the pet page and the visit form.
export function VaccineAlert({ vaccines, petName }: { vaccines: PetVaccines; petName: string }) {
  const { expired, dueSoon, missingRabies } = vaccines;
  if (expired.length === 0 && !missingRabies && dueSoon.length === 0) return null;
  const urgent = expired.length > 0 || missingRabies;

  return (
    <div className={`caution-banner${urgent ? " caution-banner-urgent" : ""}`} role="note">
      <Syringe size={18} />
      <div>
        <strong>{urgent ? "Check vaccinations before grooming" : "Vaccinations due soon"}</strong>
        <ul className="vax-alert-list">
          {missingRabies && <li>No rabies vaccination on file for {petName}.</li>}
          {expired.map((v) => <li key={v.id}>{v.vaccine} expired {vaccineDate(v.expires_on)}.</li>)}
          {dueSoon.map((v) => <li key={v.id}>{v.vaccine} expires {vaccineDate(v.expires_on)}.</li>)}
        </ul>
      </div>
    </div>
  );
}

type Props = { vaccines: PetVaccines; records: VetRecord[]; petId: string; basePath: string; canEdit: boolean };

function RecordThumb({ record }: { record: VetRecord }) {
  if (!record.url) return <span className="vet-thumb vet-thumb-missing"><FileText size={22} /></span>;
  return (
    <a href={record.url} target="_blank" rel="noopener noreferrer" className="vet-thumb" title={`Open ${record.fileName}`}>
      {record.isImage
        // Signed links to a private bucket, so next/image can't optimize them.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={record.url} alt={`Vet record: ${record.fileName}`} loading="lazy" />
        : <span className="vet-thumb-file"><FileText size={22} /><small>{record.isPdf ? "PDF" : "Photo"}</small></span>}
    </a>
  );
}

export function VaccinationsSection({ vaccines, records, petId, basePath, canEdit }: Props) {
  const { current, earlier, missingRabies } = vaccines;
  const recordsFor = (vaccinationId: string) => records.filter((r) => r.vaccinationId === vaccinationId);
  const vaccineName = new Map([...current, ...earlier].map((v) => [v.id, v.vaccine]));

  return (
    <section className="team-card" id="vaccinations" aria-labelledby="vax-title">
      <div className="section-heading compact-heading">
        <div><span className="section-eyebrow">ON FILE</span><h2 id="vax-title">Vaccinations</h2></div>
        {canEdit && <Link href={`${basePath}/vaccinations/new`} className="button-quiet"><Plus size={14} /> Add vaccination</Link>}
      </div>

      {current.length === 0 ? (
        <p className="team-empty">
          No vaccinations on file.{canEdit && <> <Link href={`${basePath}/vaccinations/new?vaccine=Rabies`} className="text-link">Add rabies first</Link></>}
        </p>
      ) : (
        <ul className="vax-list">
          {current.map((v) => (
            <li key={v.id} className={`vax-row-${v.status}`}>
              <div className="vax-copy">
                <strong>{v.vaccine}</strong>
                <small className="vax-dates">
                  {v.status === "expired" ? "Expired" : "Expires"} {vaccineDate(v.expires_on)}
                  {v.given_on && ` · given ${vaccineDate(v.given_on)}`}
                </small>
                {v.notes && <small>{v.notes}</small>}
                {recordsFor(v.id).map((r) => r.url && (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="vax-record-link"><Paperclip size={12} /> View vet record</a>
                ))}
              </div>
              <div className="member-side">
                {v.verified && <span className="vax-proof"><ShieldCheck size={13} /> Proof seen</span>}
                <span className={`vax-status vax-${v.status}`}>
                  {v.status !== "current" && <TriangleAlert size={12} />} {STATUS_LABELS[v.status]}
                </span>
                {canEdit && v.status !== "current" && (
                  <Link href={`${basePath}/vaccinations/new?vaccine=${encodeURIComponent(v.vaccine)}`} className="button-quiet">Renew</Link>
                )}
                {canEdit && (
                  <Link href={`${basePath}/vaccinations/${v.id}/edit`} className="button-quiet" aria-label={`Fix the ${v.vaccine} record`}>
                    <PencilLine size={13} />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {missingRabies && current.length > 0 && (
        <p className="vax-missing"><TriangleAlert size={13} /> No rabies vaccination on file.</p>
      )}

      {earlier.length > 0 && (
        <details className="archived-pets">
          <summary>{earlier.length} earlier {earlier.length === 1 ? "record" : "records"}</summary>
          <ul className="removed-visits">
            {earlier.map((v) => (
              <li key={v.id}>
                <strong>{v.vaccine}</strong> · valid until {vaccineDate(v.expires_on)}{v.given_on && `, given ${vaccineDate(v.given_on)}`}
                {canEdit && <> · <Link href={`${basePath}/vaccinations/${v.id}/edit`} className="text-link">Fix</Link></>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="vet-records" id="vet-records">
        <div className="vet-records-head">
          <span className="section-eyebrow">VET RECORDS</span>
          {canEdit && <Link href={`${basePath}/vet-records/new`} className="button-quiet"><Camera size={14} /> Upload vet record</Link>}
        </div>
        {records.length === 0 ? (
          <p className="team-empty">No vet records uploaded yet. Upload a photo of the vaccination certificate so the whole team can see the proof.</p>
        ) : (
          <ul className="vet-grid">
            {records.map((r) => (
              <li key={r.id}>
                <RecordThumb record={r} />
                <small className="vet-caption">
                  {r.vaccinationId ? vaccineName.get(r.vaccinationId) ?? "Vaccine record" : "General record"} · {shortDate(r.uploadedAt)}
                </small>
                {canEdit && (
                  <ActionButton
                    action={removeVetRecord}
                    fields={{ documentId: r.id, petId }}
                    label="Remove"
                    pendingLabel="Removing…"
                    confirm="Remove this vet record from the pet's file? Use this if it was uploaded by mistake or for the wrong pet."
                    className="link-button vet-remove"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
