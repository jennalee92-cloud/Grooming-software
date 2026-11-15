import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PawPrint } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clientName, getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { PetForm } from "../../../pet-form";

export const metadata: Metadata = { title: "Add pet | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewPetPage({ params }: PageProps<"/clients/[clientId]/pets/new">) {
  const { clientId } = await params;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId)) notFound();
  const record = await getClientWithPets(workspace, clientId);
  if (!record) notFound();
  if (!canEditClients(workspace.role) || record.client.archived_at) redirect(`/clients/${clientId}`);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Add pet">
      <div className="setup-page">
        <Link href={`/clients/${clientId}`} className="setup-back"><ArrowLeft size={15} /> Back to {clientName(record.client)}</Link>
        <span className="overline setup-overline"><PawPrint size={14} /> NEW PET</span>
        <h1>Add a pet to<br /><em>{clientName(record.client)}.</em></h1>
        <p className="setup-lede">Only a name is required. Care notes and grooming instructions show up for the whole team.</p>
        <section className="team-card member-edit">
          <PetForm clientId={clientId} />
        </section>
      </div>
    </AppShell>
  );
}
