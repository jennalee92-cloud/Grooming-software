import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clientName, getClientWithPets } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canEditClients } from "@/lib/roles";
import { ClientForm } from "../../client-form";
import { clientDefaults } from "../../form-defaults";

export const metadata: Metadata = { title: "Edit client | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function EditClientPage({ params }: PageProps<"/clients/[clientId]/edit">) {
  const { clientId } = await params;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(clientId)) notFound();
  const record = await getClientWithPets(workspace, clientId);
  if (!record) notFound();
  if (!canEditClients(workspace.role) || record.client.archived_at) redirect(`/clients/${clientId}`);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Edit client">
      <div className="setup-page">
        <Link href={`/clients/${clientId}`} className="setup-back"><ArrowLeft size={15} /> Back to {clientName(record.client)}</Link>
        <span className="overline setup-overline"><PencilLine size={14} /> EDIT DETAILS</span>
        <h1>{clientName(record.client)}</h1>
        <section className="team-card member-edit">
          <ClientForm clientId={clientId} locations={workspace.locations} defaults={clientDefaults(record.client)} />
        </section>
      </div>
    </AppShell>
  );
}
