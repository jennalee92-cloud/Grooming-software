import Link from "next/link";
import { Camera, History, MapPin, PencilLine, Ruler, Scale, UserRound } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import type { VisitPhoto } from "@/lib/visit-photos";
import { removeVisitPhoto } from "./visit-actions";
import { BEHAVIOR_LABELS } from "@/lib/client-labels";
import { dayLabel, shortDate } from "@/lib/format";
import { SIZE_LABELS, money } from "@/lib/service-labels";
import { visitTotal, type TeamOption, type Visit, type VisitRow } from "@/lib/visits";

// One line for older versions and removed visits: services and total.
const servicesSummary = (v: VisitRow) =>
  v.visit_services.length > 0
    ? `${v.visit_services.map((l) => l.name).join(", ")} (${money(visitTotal(v))})`
    : v.services;

function Charges({ visit }: { visit: VisitRow }) {
  if (visit.visit_services.length === 0) return null;
  return (
    <table className="visit-charges">
      <tbody>
        {visit.visit_services.map((l) => (
          <tr key={l.id}>
            <td>{l.name}</td>
            <td>
              {l.list_price_cents !== null && l.list_price_cents !== l.price_cents && <s>{money(l.list_price_cents)}</s>}{" "}
              {money(l.price_cents)}
            </td>
          </tr>
        ))}
      </tbody>
      {visit.visit_services.length > 1 && (
        <tfoot><tr><th scope="row">Total</th><td>{money(visitTotal(visit))}</td></tr></tfoot>
      )}
    </table>
  );
}

type Props = {
  visits: Visit[];
  removed: Visit[];
  basePath: string; // /clients/[clientId]/pets/[petId]
  userId: string;
  canCorrectAny: boolean;
  canRecord: boolean;
  team: TeamOption[];
  locations: { id: string; name: string }[];
  photos: Map<string, VisitPhoto[]>; // by visit version id
};

const KIND_LABELS = { before: "Before", after: "After", other: "Photos" } as const;

function VisitPhotos({ photos, userId, canRemoveAny }: { photos: VisitPhoto[]; userId: string; canRemoveAny: boolean }) {
  if (photos.length === 0) return null;
  return (
    <div className="visit-photos">
      {(["before", "after", "other"] as const).map((kind) => {
        const group = photos.filter((p) => p.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind} className="visit-photo-group">
            <span className="visit-photo-label">{KIND_LABELS[kind]}</span>
            <ul>
              {group.map((p) => (
                <li key={p.id}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="visit-photo">
                      {p.viewable
                        // Signed links to a private bucket, so next/image can't optimize them.
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.url} alt={`${KIND_LABELS[kind]} photo`} loading="lazy" />
                        : <span className="vet-thumb-file"><Camera size={18} /><small>Open</small></span>}
                    </a>
                  ) : <span className="visit-photo vet-thumb-missing"><Camera size={18} /></span>}
                  {(canRemoveAny || p.uploadedBy === userId) && (
                    <ActionButton action={removeVisitPhoto} fields={{ photoId: p.id }} label="Remove" pendingLabel="…"
                      confirm="Remove this photo from the visit?" className="link-button vet-remove" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Server component: renders a pet's visit history from versioned rows.
export function VisitHistory({ visits, removed, basePath, userId, canCorrectAny, canRecord, team, locations, photos }: Props) {
  const byMember = new Map(team.map((m) => [m.memberId, m.label]));
  const byUser = new Map(team.map((m) => [m.userId, m.label]));
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? "Another location";
  const recorder = (v: VisitRow) => (v.created_by ? byUser.get(v.created_by) : undefined) ?? "a former team member";

  if (visits.length === 0 && removed.length === 0) {
    return (
      <p className="team-empty">
        No visits recorded yet.{canRecord && <> <Link href={`${basePath}/visits/new`} className="text-link">Record the first visit</Link></>}
      </p>
    );
  }

  return (
    <>
      <ol className="visit-list">
        {visits.map(({ current: v, earlier }) => {
          const canCorrect = canRecord && (canCorrectAny || v.created_by === userId);
          return (
            <li key={v.id} className="visit-card">
              <div className="visit-head">
                <strong>{dayLabel(v.visited_on)}</strong>
                {v.behavior && <span className={`behavior-chip behavior-${v.behavior}`}>{BEHAVIOR_LABELS[v.behavior]}</span>}
              </div>
              <div className="visit-meta">
                <span><MapPin size={13} /> {locationName(v.location_id)}</span>
                {v.groomer_member_id && <span><UserRound size={13} /> {byMember.get(v.groomer_member_id) ?? "Former team member"}</span>}
                {v.weight_lbs && <span><Scale size={13} /> {v.weight_lbs} lbs</span>}
                {v.pet_size && <span><Ruler size={13} /> {SIZE_LABELS[v.pet_size]}</span>}
              </div>
              <Charges visit={v} />
              {v.services && <p className="visit-services">{v.services}</p>}
              {v.cut_details && <div className="visit-field"><span>Cut</span><p className="prewrap-text">{v.cut_details}</p></div>}
              {v.notes && <div className="visit-field"><span>Notes</span><p className="prewrap-text">{v.notes}</p></div>}
              <VisitPhotos photos={[v, ...earlier].flatMap((x) => photos.get(x.id) ?? [])} userId={userId} canRemoveAny={canCorrectAny} />

              {earlier.length > 0 && (
                <details className="visit-versions">
                  <summary><History size={13} /> Corrected: {v.correction_reason} · see {earlier.length === 1 ? "the original" : `${earlier.length} earlier versions`}</summary>
                  <ol>
                    {earlier.map((e) => (
                      <li key={e.id}>
                        <small>{e.corrects_visit_id ? `Correction (${e.correction_reason})` : "Original"} recorded by {recorder(e)}, {shortDate(e.created_at)}</small>
                        <p>{[dayLabel(e.visited_on), locationName(e.location_id), servicesSummary(e), e.behavior && BEHAVIOR_LABELS[e.behavior], e.weight_lbs && `${e.weight_lbs} lbs`].filter(Boolean).join(" · ")}</p>
                        {e.cut_details && <p className="prewrap-text">Cut: {e.cut_details}</p>}
                        {e.notes && <p className="prewrap-text">Notes: {e.notes}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <div className="visit-foot">
                <small>Recorded by {recorder(earlier.at(-1) ?? v)}{earlier.length > 0 && `, corrected by ${recorder(v)}`}</small>
                <span className="member-side">
                  {canRecord && <Link href={`${basePath}/visits/${v.id}/photos`} className="button-quiet"><Camera size={13} /> Add photos</Link>}
                  {canCorrect && <Link href={`${basePath}/visits/${v.id}/correct`} className="button-quiet"><PencilLine size={13} /> Correct</Link>}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {removed.length > 0 && (
        <details className="archived-pets">
          <summary>{removed.length} removed {removed.length === 1 ? "visit" : "visits"}, kept for the record</summary>
          <ul className="removed-visits">
            {removed.map(({ current: v, earlier }) => {
              const original = earlier[0] ?? v;
              return (
                <li key={v.id}>
                  <strong>{dayLabel(original.visited_on)}</strong> · {servicesSummary(original) ?? "No services noted"}
                  <small>Removed by {recorder(v)}, {shortDate(v.created_at)}: {v.correction_reason}</small>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </>
  );
}
