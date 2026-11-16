import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { canManageChecklists } from "@/lib/roles";
import { ChecklistForm } from "../../checklist-form";

export const metadata: Metadata = { title: "New checklist | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewChecklistPage() {
  const workspace = await requireWorkspace();
  if (!canManageChecklists(workspace.role)) redirect("/checklists");

  return (
    <AppShell workspace={workspace} active="checklists" crumb="New checklist">
      <div className="setup-page">
        <Link href="/checklists/manage" className="setup-back"><ArrowLeft size={15} /> Back to checklists</Link>
        <span className="overline setup-overline"><ClipboardCheck size={14} /> NEW CHECKLIST</span>
        <h1>Build a<br /><em>checklist.</em></h1>
        <section className="team-card member-edit">
          <ChecklistForm locations={workspace.locations} defaults={{ name: "", description: "", frequency: "daily", locationId: "", tasks: [] }} />
        </section>
      </div>
    </AppShell>
  );
}
