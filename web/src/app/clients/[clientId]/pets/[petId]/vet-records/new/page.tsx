import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileImage } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { getPetVaccinations } from "@/lib/vaccinations";
import { vaccineDate } from "@/lib/vaccine-labels";
import { todayIn } from "@/lib/visits";
import { VetRecordUploadForm } from "../../../../../vet-record-upload-form";

export const metadata: Metadata = { title: "Upload vet record | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function UploadVetRecordPage({ params, searchParams }: PageProps<"/clients/[clientId]/pets/[petId]/vet-records/new">) {
  const { clientId, petId } = await params;
  const { vaccination } = await searchParams;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  const petPage = `/clients/${clientId}/pets/${petId}`;
  if (!canEditClients(workspace.role) || pet.archived_at || record.client.archived_at) redirect(`${petPage}#vaccinations`);

  const home = workspace.locations.find((l) => l.id === record.client.home_location_id) ?? workspace.locations[0];
  const vaccines = await getPetVaccinations(workspace, petId, pet.species, todayIn(home?.timezone));
  const options = [...vaccines.current, ...vaccines.earlier].map((v) => ({ id: v.id, label: `${v.vaccine} (expires ${vaccineDate(v.expires_on)})` }));

  return (
    <AppShell workspace={workspace} active="clients" crumb="Upload vet record">
      <div className="setup-page">
        <Link href={`${petPage}#vaccinations`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><FileImage size={14} /> VET RECORD</span>
        <h1>Upload a vet record for<br /><em>{pet.name}.</em></h1>
        <p className="setup-lede">A photo of the vaccination certificate or invoice. It&apos;s private to your business and can&apos;t be edited or deleted after upload, only marked removed.</p>
        <section className="team-card member-edit">
          <VetRecordUploadForm
            clientId={clientId}
            petId={petId}
            vaccines={options}
            defaultLink={typeof vaccination === "string" && options.some((o) => o.id === vaccination) ? vaccination : ""}
          />
        </section>
      </div>
    </AppShell>
  );
}
