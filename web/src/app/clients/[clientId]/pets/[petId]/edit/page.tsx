import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { petDefaults } from "../../../../form-defaults";
import { PetForm } from "../../../../pet-form";

export const metadata: Metadata = { title: "Edit pet | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function EditPetPage({ params }: PageProps<"/clients/[clientId]/pets/[petId]/edit">) {
  const { clientId, petId } = await params;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(petId)) notFound();

  const record = await getClientWithPets(workspace, clientId);
  const pet = record?.pets.find((p) => p.id === petId);
  if (!record || !pet) notFound();
  if (!canEditClients(workspace.role) || pet.archived_at || record.client.archived_at) {
    redirect(`/clients/${clientId}/pets/${petId}`);
  }

  return (
    <AppShell workspace={workspace} active="clients" crumb="Edit pet">
      <div className="setup-page">
        <Link href={`/clients/${clientId}/pets/${petId}`} className="setup-back"><ArrowLeft size={15} /> Back to {pet.name}</Link>
        <span className="overline setup-overline"><PencilLine size={14} /> EDIT PET</span>
        <h1>{pet.name}</h1>
        <section className="team-card member-edit">
          <PetForm clientId={clientId} petId={petId} defaults={petDefaults(pet)} />
        </section>
      </div>
    </AppShell>
  );
}
