import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, PawPrint, PencilLine, Plus, Scissors, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { SEX_LABELS, SPECIES_LABELS, clientName, getClientWithPets, petAge } from "@/lib/clients";
import { requireUser, requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { dayLabel } from "@/lib/format";
import { canArchiveClients, canEditClients } from "@/lib/roles";
import { getPetVaccinations } from "@/lib/vaccinations";
import { getVetRecords } from "@/lib/vet-records";
import { getVisitPhotos } from "@/lib/visit-photos";
import { getPetVisits, getTeamOptions, todayIn } from "@/lib/visits";
import { setPetArchived } from "../../../actions";
import { VaccineAlert, VaccinationsSection } from "../../../vaccinations-section";
import { VisitHistory } from "../../../visit-history";

export const metadata: Metadata = { title: "Pet profile | Grooming Desk" };

const VISIT_NOTICES: Record<string, string> = {
  added: "Visit recorded.",
  corrected: "Correction saved. The earlier version is kept in the history.",
  removed: "Visit removed. It's kept in the history with your reason.",
  photos: "Photos added.",
};

const VACCINE_NOTICES: Record<string, string> = {
  added: "Vaccination added.",
  saved: "Vaccination record updated.",
  removed: "Vaccination record removed.",
  uploaded: "Vet record uploaded.",
};

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function PetPage({ params, searchParams }: PageProps<"/clients/[clientId]/pets/[petId]">) {
  const { clientId, petId } = await params;
  const notice = await searchParams;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();

  const archived = pet.archived_at !== null;
  const canEdit = canEditClients(workspace.role) && !archived && !record.client.archived_at;
  // Every role records visits; archived pets and households are read-only.
  const canRecord = !archived && !record.client.archived_at;
  const basePath = `/clients/${clientId}/pets/${pet.id}`;
  const home = workspace.locations.find((l) => l.id === record.client.home_location_id) ?? workspace.locations[0];
  const [user, history, team, vaccines, vetRecords, visitPhotos] = await Promise.all([
    requireUser(),
    getPetVisits(workspace, pet.id),
    getTeamOptions(workspace),
    getPetVaccinations(workspace, pet.id, pet.species, todayIn(home?.timezone)),
    getVetRecords(workspace, pet.id),
    getVisitPhotos(workspace, pet.id),
  ]);
  const lastVisit = history.visits[0]?.current.visited_on;
  const canArchive = canArchiveClients(workspace.role) && !record.client.archived_at;
  const age = petAge(pet.birth_date);

  const facts: [string, string | null][] = [
    ["Species", SPECIES_LABELS[pet.species]],
    ["Breed", pet.breed],
    ["Sex", pet.sex === "unknown" ? null : SEX_LABELS[pet.sex]],
    ["Spayed or neutered", pet.fixed === null ? null : pet.fixed ? "Yes" : "No"],
    ["Age", age],
    ["Weight", pet.weight_lbs ? `${pet.weight_lbs} lbs` : null],
    ["Color", pet.color],
    ["Coat", pet.coat],
  ];

  const care: [string, string | null][] = [
    ["Temperament and handling", pet.temperament],
    ["Allergies", pet.allergies],
    ["Medical notes", pet.medical_notes],
  ];

  return (
    <AppShell workspace={workspace} active="clients" crumb="Pet profile">
      <div className="setup-page record-page">
        <Link href={`/clients/${clientId}`} className="setup-back"><ArrowLeft size={15} /> Back to {clientName(record.client)}</Link>
        <span className="overline setup-overline"><PawPrint size={14} /> {[SPECIES_LABELS[pet.species], pet.breed].filter(Boolean).join(" · ").toUpperCase()}</span>
        <h1>{pet.name}{archived && <span className="status-chip status-chip-title">Archived</span>}</h1>
        <p className="setup-lede">Part of the {clientName(record.client)} household. {lastVisit ? `Last visit ${dayLabel(lastVisit)}.` : "No visits recorded yet."}</p>

        {notice.created === "1" && <p className="form-notice"><CircleCheck size={16} /> Pet added.</p>}
        {notice.saved === "1" && <p className="form-notice"><CircleCheck size={16} /> Changes saved.</p>}
        {typeof notice.visit === "string" && VISIT_NOTICES[notice.visit] && <p className="form-notice"><CircleCheck size={16} /> {VISIT_NOTICES[notice.visit]}</p>}
        {typeof notice.vaccine === "string" && VACCINE_NOTICES[notice.vaccine] && <p className="form-notice"><CircleCheck size={16} /> {VACCINE_NOTICES[notice.vaccine]}</p>}
        {typeof notice.photos === "string" && <p className="form-error" role="alert"><TriangleAlert size={16} /> {notice.photos === "1" ? "One photo" : `${notice.photos.slice(0, 2)} photos`} didn&apos;t upload. Use Add photos on the visit to try again.</p>}
        {notice.vaccine === "uploadError" && <p className="form-error" role="alert"><TriangleAlert size={16} /> Everything else was saved, but the vet record photo didn&apos;t upload. Use Upload vet record below to try again.</p>}
        {notice.vaccine === "error" && <p className="form-error" role="alert"><TriangleAlert size={16} /> {pet.name} was saved, but the rabies record wasn&apos;t. Add it in the Vaccinations section below.</p>}

        {!archived && <VaccineAlert vaccines={vaccines} petName={pet.name} />}

        {pet.handle_with_care && (
          <div className="caution-banner" role="note">
            <TriangleAlert size={18} />
            <div><strong>Handle with care</strong>{pet.temperament && <p>{pet.temperament}</p>}</div>
          </div>
        )}

        <div className="record-actions">
          {canRecord && <Link href={`${basePath}/visits/new`} className="button-primary"><Scissors size={14} /> Record visit</Link>}
          {canEdit && <Link href={`/clients/${clientId}/pets/${pet.id}/edit`} className="button-quiet"><PencilLine size={14} /> Edit pet</Link>}
          {canArchive && (
            <ActionButton
              action={setPetArchived}
              fields={{ petId: pet.id, archived: archived ? "false" : "true" }}
              label={archived ? "Restore pet" : "Archive pet"}
              pendingLabel="Saving…"
              confirm={archived ? undefined : `Archive ${pet.name}? Use this if they've passed away or moved on. Nothing is deleted, and you can restore them.`}
              className={archived ? "button-quiet" : "button-quiet button-quiet-danger"}
            />
          )}
        </div>

        <section className="team-card" aria-labelledby="grooming-title">
          <div className="section-heading compact-heading"><div><span className="section-eyebrow">EVERY VISIT</span><h2 id="grooming-title">Grooming instructions</h2></div><Scissors size={18} className="team-card-icon" /></div>
          {pet.grooming_instructions
            ? <p className="prewrap-text">{pet.grooming_instructions}</p>
            : <p className="team-empty">No standing instructions yet.</p>}
        </section>

        <section className="team-card" aria-labelledby="profile-title">
          <div className="section-heading compact-heading"><div><span className="section-eyebrow">PROFILE</span><h2 id="profile-title">About {pet.name}</h2></div></div>
          <dl className="detail-list">
            {facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd className={value ? undefined : "is-empty"}>{value ?? "Not added"}</dd></div>
            ))}
          </dl>
          <dl className="detail-list detail-list-wide">
            {care.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd className={value ? "prewrap-text" : "is-empty"}>{value ?? "None noted"}</dd></div>
            ))}
          </dl>
        </section>

        <section className="team-card" id="history" aria-labelledby="history-title">
          <div className="section-heading compact-heading">
            <div><span className="section-eyebrow">NEVER OVERWRITTEN</span><h2 id="history-title">Visit history</h2></div>
            {canRecord && <Link href={`${basePath}/visits/new`} className="button-quiet"><Plus size={14} /> Record visit</Link>}
          </div>
          <VisitHistory
            visits={history.visits}
            removed={history.removed}
            basePath={basePath}
            userId={user.id}
            canCorrectAny={canArchiveClients(workspace.role)}
            canRecord={canRecord}
            team={team}
            locations={workspace.locations}
            photos={visitPhotos}
          />
        </section>

        <VaccinationsSection vaccines={vaccines} records={vetRecords} petId={pet.id} basePath={basePath} canEdit={canEdit} />
      </div>
    </AppShell>
  );
}
