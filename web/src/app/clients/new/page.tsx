import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { canEditClients } from "@/lib/roles";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Add client | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewClientPage() {
  const workspace = await requireWorkspace();
  if (!canEditClients(workspace.role)) redirect("/clients");

  return (
    <AppShell workspace={workspace} active="clients" crumb="Add client">
      <div className="setup-page">
        <Link href="/clients" className="setup-back"><ArrowLeft size={15} /> Back to clients</Link>
        <span className="overline setup-overline"><UserPlus size={14} /> NEW HOUSEHOLD</span>
        <h1>Add a <em>client.</em></h1>
        <p className="setup-lede">Only a first name is required. You can fill in the rest now or later.</p>
        <section className="team-card member-edit">
          <ClientForm locations={workspace.locations} />
        </section>
      </div>
    </AppShell>
  );
}
