import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getChecklists } from "@/lib/checklists";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canManageChecklists } from "@/lib/roles";
import { ChecklistForm } from "../../checklist-form";

export const metadata: Metadata = { title: "Edit checklist | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function EditChecklistPage({ params }: PageProps<"/checklists/manage/[checklistId]">) {
  const { checklistId } = await params;
  const workspace = await requireWorkspace();
  if (!canManageChecklists(workspace.role)) redirect("/checklists");
  if (!UUID_PATTERN.test(checklistId)) notFound();

  const { active, archived } = await getChecklists(workspace);
  const c = [...active, ...archived].find((x) => x.id === checklistId);
  if (!c) notFound();

  return (
    <AppShell workspace={workspace} active="checklists" crumb="Edit checklist">
      <div className="setup-page">
        <Link href="/checklists/manage" className="setup-back"><ArrowLeft size={15} /> Back to checklists</Link>
        <span className="overline setup-overline"><ClipboardCheck size={14} /> EDIT CHECKLIST</span>
        <h1>Edit<br /><em>{c.name}.</em></h1>
        <section className="team-card member-edit">
          <ChecklistForm
            checklistId={c.id}
            locations={workspace.locations}
            defaults={{
              name: c.name,
              description: c.description ?? "",
              frequency: c.frequency,
              locationId: c.location_id ?? "",
              tasks: c.tasks.map((t) => ({ id: t.id, label: t.label, details: t.details ?? "" })),
            }}
          />
        </section>
      </div>
    </AppShell>
  );
}
