import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CircleCheck, PawPrint, PencilLine, Scissors, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { SEX_LABELS, SPECIES_LABELS, clientName, getClientWithPets, petAge } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canArchiveClients, canEditClients } from "@/lib/roles";
import { setPetArchived } from "../../../actions";

export const metadata: Metadata = { title: "Pet profile | Grooming Desk" };

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
  const canArchive = canArchiveClients(workspace.role) && !record.client.archived_at;
  const age = petAge(pet.birth_date);

  const facts: [string, string | null][] = [
    ["Species", SPECIES_LABELS[pet.species]],
    ["Breed", pet.breed],
    ["Sex", pet.sex === "unknown" ? null : SEX_LABELS[pet.sex]],
    ["Spayed or neutered", pet.fixed === null ? null : pet.fixed ? "Yes" : "No"],
    ["Age", age ? `${age} (born ${pet.birth_date})` : null],
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
        <p className="setup-lede">Part of the {clientName(record.client)} household.</p>

        {notice.created === "1" && <p className="form-notice"><CircleCheck size={16} /> Pet added.</p>}
        {notice.saved === "1" && <p className="form-notice"><CircleCheck size={16} /> Changes saved.</p>}

        {pet.handle_with_care && (
          <div className="caution-banner" role="note">
            <TriangleAlert size={18} />
            <div><strong>Handle with care</strong>{pet.temperament && <p>{pet.temperament}</p>}</div>
          </div>
        )}

        <div className="record-actions">
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

        <section className="team-card" aria-labelledby="history-title">
          <div className="section-heading compact-heading"><div><span className="section-eyebrow">HISTORY</span><h2 id="history-title">Visits and vaccinations</h2></div><CalendarClock size={18} className="team-card-icon" /></div>
          <p className="team-empty">Grooming visit history and vaccination records are the next parts being built. They&apos;ll appear here.</p>
        </section>
      </div>
    </AppShell>
  );
}
