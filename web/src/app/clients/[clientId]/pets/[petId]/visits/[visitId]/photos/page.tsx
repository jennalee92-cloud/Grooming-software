import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { dayLabel } from "@/lib/format";
import { getPetVisits } from "@/lib/visits";
import { AddPhotosForm } from "../../../../../../add-photos-form";

export const metadata: Metadata = { title: "Add visit photos | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function AddVisitPhotosPage({ params }: PageProps<"/clients/[clientId]/pets/[petId]/visits/[visitId]/photos">) {
  const { clientId, petId, visitId } = await params;
  const workspace = await requireWorkspace();
  if (![clientId, petId, visitId].every((id) => UUID_PATTERN.test(id))) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  const petPage = `/clients/${clientId}/pets/${petId}`;

  // Photos go on the current version of a visit that hasn't been removed.
  const { visits } = await getPetVisits(workspace, petId);
  const visit = visits.find((v) => v.current.id === visitId)?.current;
  if (!visit || pet.archived_at || record.client.archived_at) redirect(`${petPage}#history`);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Add visit photos">
      <div className="setup-page">
        <Link href={`${petPage}#history`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><Camera size={14} /> VISIT PHOTOS</span>
        <h1>Photos of {pet.name}<br /><em>{dayLabel(visit.visited_on)}.</em></h1>
        <p className="setup-lede">Photos are private to your business. Anyone on the team can see them on {pet.name}&apos;s history.</p>
        <section className="team-card member-edit">
          <AddPhotosForm clientId={clientId} petId={petId} visitId={visitId} />
        </section>
      </div>
    </AppShell>
  );
}
