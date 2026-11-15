import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Syringe } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { COMMON_VACCINES } from "@/lib/vaccine-labels";
import { todayIn } from "@/lib/visits";
import { VaccinationForm } from "../../../../../vaccination-form";

export const metadata: Metadata = { title: "Add vaccination | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewVaccinationPage({ params, searchParams }: PageProps<"/clients/[clientId]/pets/[petId]/vaccinations/new">) {
  const { clientId, petId } = await params;
  const { vaccine } = await searchParams;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  const petPage = `/clients/${clientId}/pets/${petId}`;
  if (!canEditClients(workspace.role) || pet.archived_at || record.client.archived_at) redirect(`${petPage}#vaccinations`);

  const home = workspace.locations.find((l) => l.id === record.client.home_location_id) ?? workspace.locations[0];

  return (
    <AppShell workspace={workspace} active="clients" crumb="Add vaccination">
      <div className="setup-page">
        <Link href={`${petPage}#vaccinations`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><Syringe size={14} /> VACCINATION</span>
        <h1>Add a vaccine for<br /><em>{pet.name}.</em></h1>
        <p className="setup-lede">For a renewal, add it as a new record. The old one stays in the history.</p>
        <section className="team-card member-edit">
          <VaccinationForm
            clientId={clientId}
            petId={petId}
            suggestions={COMMON_VACCINES[pet.species]}
            today={todayIn(home?.timezone)}
            defaults={{ vaccine: typeof vaccine === "string" ? vaccine.slice(0, 80) : "" }}
          />
        </section>
      </div>
    </AppShell>
  );
}
