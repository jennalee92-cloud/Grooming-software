import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireUser, requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canArchiveClients } from "@/lib/roles";
import { getPetVisits, getTeamOptions, todayIn } from "@/lib/visits";
import { visitDefaults } from "../../../../../../form-defaults";
import { VisitForm } from "../../../../../../visit-form";

export const metadata: Metadata = { title: "Correct visit | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function CorrectVisitPage({ params }: PageProps<"/clients/[clientId]/pets/[petId]/visits/[visitId]/correct">) {
  const { clientId, petId, visitId } = await params;
  const [workspace, user] = await Promise.all([requireWorkspace(), requireUser()]);
  if (![clientId, petId, visitId].every((id) => UUID_PATTERN.test(id))) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();

  const petPage = `/clients/${clientId}/pets/${petId}`;
  const { visits } = await getPetVisits(workspace, petId);
  // Only the current version of a visit can be corrected.
  const visit = visits.find((v) => v.current.id === visitId)?.current;
  if (!visit) redirect(`${petPage}#history`);
  if (visit.created_by !== user.id && !canArchiveClients(workspace.role)) redirect(`${petPage}#history`);

  const team = (await getTeamOptions(workspace)).filter((m) => m.active || m.memberId === visit.groomer_member_id);
  const location = workspace.locations.find((l) => l.id === visit.location_id);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Correct visit">
      <div className="setup-page">
        <Link href={`${petPage}#history`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><History size={14} /> CORRECTION</span>
        <h1>Correct a visit for<br /><em>{pet.name}.</em></h1>
        <p className="setup-lede">Change what needs fixing and say why. The original version is kept and stays visible in the history.</p>
        <section className="team-card member-edit">
          {location ? (
            <VisitForm
              clientId={clientId}
              petId={petId}
              correctsVisitId={visit.id}
              locations={workspace.locations}
              team={team}
              today={todayIn(location.timezone)}
              defaults={visitDefaults(visit)}
            />
          ) : (
            <p className="team-empty">This visit was recorded at a location you don&apos;t work at, so it can only be corrected by an owner or admin.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
