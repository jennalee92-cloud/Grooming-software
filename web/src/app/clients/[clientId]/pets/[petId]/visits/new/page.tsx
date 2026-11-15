import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Scissors, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canManageServices } from "@/lib/roles";
import { suggestSize } from "@/lib/service-labels";
import { getMenu } from "@/lib/services";
import { getPetVisits, getTeamOptions, todayIn } from "@/lib/visits";
import { VisitForm } from "../../../../../visit-form";

export const metadata: Metadata = { title: "Record visit | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewVisitPage({ params }: PageProps<"/clients/[clientId]/pets/[petId]/visits/new">) {
  const { clientId, petId } = await params;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  if (pet.archived_at || record.client.archived_at) redirect(`/clients/${clientId}/pets/${petId}`);

  const [allTeam, menu, { visits }] = await Promise.all([getTeamOptions(workspace), getMenu(workspace), getPetVisits(workspace, petId)]);
  const team = allTeam.filter((m) => m.active);
  // Size from the last visit that recorded one, else from the pet's weight.
  const lastSize = visits.find((v) => v.current.pet_size)?.current.pet_size ?? null;
  const home = workspace.locations.find((l) => l.id === record.client.home_location_id);
  const timeZone = (home ?? workspace.locations[0])?.timezone;

  return (
    <AppShell workspace={workspace} active="clients" crumb="Record visit">
      <div className="setup-page">
        <Link href={`/clients/${clientId}/pets/${petId}`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><Scissors size={14} /> NEW VISIT</span>
        <h1>Record a visit for<br /><em>{pet.name}.</em></h1>
        {pet.handle_with_care && (
          <div className="caution-banner" role="note"><TriangleAlert size={18} /><div><strong>Handle with care</strong>{pet.temperament && <p>{pet.temperament}</p>}</div></div>
        )}
        {pet.grooming_instructions && (
          <div className="note-block"><span className="section-eyebrow">STANDING INSTRUCTIONS</span><p>{pet.grooming_instructions}</p></div>
        )}
        <section className="team-card member-edit">
          <VisitForm
            clientId={clientId}
            petId={petId}
            locations={workspace.locations}
            team={team}
            today={todayIn(timeZone)}
            defaults={{ locationId: home?.id ?? workspace.locations[0]?.id ?? "", groomerMemberId: workspace.memberId }}
            menu={menu}
            suggestedSize={lastSize ?? suggestSize(pet.weight_lbs)}
            canEditMenu={canManageServices(workspace.role)}
          />
        </section>
      </div>
    </AppShell>
  );
}
