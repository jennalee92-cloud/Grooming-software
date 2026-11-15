import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, CircleAlert, CircleCheck, Dog, Home, PencilLine, Plus, TriangleAlert } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { CONTACT_LABELS, SPECIES_LABELS, clientName, getClientWithPets, petAge } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canArchiveClients, canEditClients } from "@/lib/roles";
import { setClientArchived } from "../actions";

export const metadata: Metadata = { title: "Client | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[clientId]">) {
  const { clientId } = await params;
  const notice = await searchParams;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  if (!record) notFound();
  const { client, pets } = record;
  const archived = client.archived_at !== null;
  const canEdit = canEditClients(workspace.role) && !archived;
  const canArchive = canArchiveClients(workspace.role);
  const activePets = pets.filter((p) => p.archived_at === null);
  const archivedPets = pets.filter((p) => p.archived_at !== null);
  const home = client.home_location_id
    ? workspace.locations.find((l) => l.id === client.home_location_id)?.name ?? "Another location"
    : null;

  const details: [string, string | null][] = [
    ["Phone", client.phone],
    ["Second phone", client.alt_phone],
    ["Email", client.email],
    ["Prefers", client.preferred_contact ? CONTACT_LABELS[client.preferred_contact] : null],
    ["Usual location", home],
    ["Address", client.address],
    ["Emergency contact", client.emergency_contact],
  ];

  return (
    <AppShell workspace={workspace} active="clients" crumb="Clients & pets">
      <div className="setup-page record-page">
        <Link href="/clients" className="setup-back"><ArrowLeft size={15} /> Back to clients</Link>
        <span className="overline setup-overline"><Home size={14} /> HOUSEHOLD</span>
        <h1>{clientName(client)}{archived && <span className="status-chip status-chip-title">Archived</span>}</h1>

        {notice.created === "1" && <p className="form-notice"><CircleCheck size={16} /> Client added.</p>}
        {notice.saved === "1" && <p className="form-notice"><CircleCheck size={16} /> Changes saved.</p>}
        {notice.petError === "1" && <p className="form-error"><CircleAlert size={16} /> The client was added, but the first pet couldn&apos;t be saved. Add it below.</p>}

        <div className="record-actions">
          {canEdit && <Link href={`/clients/${client.id}/edit`} className="button-quiet"><PencilLine size={14} /> Edit details</Link>}
          {canEdit && <Link href={`/clients/${client.id}/pets/new`} className="button-quiet"><Plus size={14} /> Add pet</Link>}
          {canArchive && (
            <ActionButton
              action={setClientArchived}
              fields={{ clientId: client.id, archived: archived ? "false" : "true" }}
              label={archived ? "Restore client" : "Archive client"}
              pendingLabel="Saving…"
              confirm={archived ? undefined : `Archive ${clientName(client)}? They'll be hidden from search, but nothing is deleted and you can restore them.`}
              className={archived ? "button-quiet" : "button-quiet button-quiet-danger"}
            />
          )}
        </div>

        <section className="team-card" aria-labelledby="contact-title">
          <div className="section-heading compact-heading"><div><span className="section-eyebrow">HOW TO REACH THEM</span><h2 id="contact-title">Contact</h2></div></div>
          <dl className="detail-list">
            {details.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd className={value ? undefined : "is-empty"}>{value ?? "Not added"}</dd></div>
            ))}
          </dl>
          {client.notes && <div className="note-block"><span className="section-eyebrow">NOTES</span><p>{client.notes}</p></div>}
        </section>

        <section className="team-card" aria-labelledby="pets-title">
          <div className="section-heading compact-heading">
            <div><span className="section-eyebrow">IN THIS HOUSEHOLD</span><h2 id="pets-title">Pets</h2></div>
            <span className="checklist-count">{String(activePets.length).padStart(2, "0")}</span>
          </div>
          {activePets.length === 0 ? (
            <div className="empty-state">
              <Dog size={24} strokeWidth={1.5} />
              <p>No pets yet.{canEdit && <> <Link href={`/clients/${client.id}/pets/new`} className="text-link">Add a pet</Link></>}</p>
            </div>
          ) : (
            <ul className="pet-cards">
              {activePets.map((p) => {
                const facts = [SPECIES_LABELS[p.species], p.breed, petAge(p.birth_date), p.weight_lbs ? `${p.weight_lbs} lbs` : null].filter(Boolean);
                return (
                  <li key={p.id}>
                    <Link href={`/clients/${client.id}/pets/${p.id}`} className={`pet-card${p.handle_with_care ? " is-caution" : ""}`}>
                      <span className="pet-card-main">
                        <strong>{p.name}</strong>
                        <small>{facts.join(" · ")}</small>
                        {p.handle_with_care && <span className="caution-line"><TriangleAlert size={13} /> Handle with care{p.temperament ? `: ${p.temperament}` : ""}</span>}
                        {p.allergies && <span className="allergy-line">Allergies: {p.allergies}</span>}
                      </span>
                      <ChevronRight size={17} className="row-chevron" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {archivedPets.length > 0 && (
            <details className="archived-pets">
              <summary>{archivedPets.length} archived {archivedPets.length === 1 ? "pet" : "pets"}</summary>
              <ul className="client-list">
                {archivedPets.map((p) => (
                  <li key={p.id}><Link href={`/clients/${client.id}/pets/${p.id}`} className="client-row is-off"><span className="member-copy"><strong>{p.name}</strong><small>{[SPECIES_LABELS[p.species], p.breed].filter(Boolean).join(" · ")}</small></span><ChevronRight size={17} className="row-chevron" /></Link></li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </AppShell>
  );
}
