import Link from "next/link";
import { PencilLine, Plus, ShieldCheck, Syringe, TriangleAlert } from "lucide-react";
import type { PetVaccines } from "@/lib/vaccinations";
import { STATUS_LABELS, vaccineDate } from "@/lib/vaccine-labels";

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

type Props = { vaccines: PetVaccines; basePath: string; canEdit: boolean };

export function VaccinationsSection({ vaccines, basePath, canEdit }: Props) {
  const { current, earlier, missingRabies } = vaccines;

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
    </section>
  );
}
