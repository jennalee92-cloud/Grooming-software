import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Syringe } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { getPetVaccinations } from "@/lib/vaccinations";
import { COMMON_VACCINES } from "@/lib/vaccine-labels";
import { todayIn } from "@/lib/visits";
import { removeVaccination } from "../../../../../../vaccination-actions";
import { VaccinationForm } from "../../../../../../vaccination-form";

export const metadata: Metadata = { title: "Edit vaccination | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function EditVaccinationPage({ params }: PageProps<"/clients/[clientId]/pets/[petId]/vaccinations/[vaccinationId]/edit">) {
  const { clientId, petId, vaccinationId } = await params;
  const workspace = await requireWorkspace();
  if (![clientId, petId, vaccinationId].every((id) => UUID_PATTERN.test(id))) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  const petPage = `/clients/${clientId}/pets/${petId}`;
  if (!canEditClients(workspace.role) || pet.archived_at || record.client.archived_at) redirect(`${petPage}#vaccinations`);

  const home = workspace.locations.find((l) => l.id === record.client.home_location_id) ?? workspace.locations[0];
  const today = todayIn(home?.timezone);
  const vaccines = await getPetVaccinations(workspace, petId, pet.species, today);
  const vax = [...vaccines.current, ...vaccines.earlier].find((v) => v.id === vaccinationId);
  if (!vax) redirect(`${petPage}#vaccinations`);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Edit vaccination">
      <div className="setup-page">
        <Link href={`${petPage}#vaccinations`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><Syringe size={14} /> VACCINATION</span>
        <h1>Fix a record for<br /><em>{pet.name}.</em></h1>
        <p className="setup-lede">Use this to fix a typo. For a renewal, add a new record instead so the history stays complete.</p>
        <section className="team-card member-edit">
          <VaccinationForm
            clientId={clientId}
            petId={petId}
            vaccinationId={vax.id}
            suggestions={COMMON_VACCINES[pet.species]}
            today={today}
            defaults={{
              vaccine: vax.vaccine,
              givenOn: vax.given_on ?? "",
              expiresOn: vax.expires_on,
              verified: vax.verified ? "on" : "",
              notes: vax.notes ?? "",
            }}
          />
        </section>
        <div className="record-actions">
          <ActionButton
            action={removeVaccination}
            fields={{ clientId, petId, vaccinationId: vax.id }}
            label="Remove this record"
            pendingLabel="Removing…"
            confirm="Remove this vaccination record? Use this only if it was entered by mistake. It's kept in the activity log."
            className="button-quiet button-quiet-danger"
          />
        </div>
      </div>
    </AppShell>
  );
}
