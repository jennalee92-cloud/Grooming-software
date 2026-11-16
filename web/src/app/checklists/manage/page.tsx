import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, PencilLine, Plus, Settings2, Sparkles } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { FREQUENCY_LABELS, STARTER_CHECKLISTS } from "@/lib/checklist-labels";
import { getChecklists } from "@/lib/checklists";
import { requireWorkspace } from "@/lib/dal";
import { canManageChecklists } from "@/lib/roles";
import { addStarterChecklist, setChecklistArchived } from "../actions";

export const metadata: Metadata = { title: "Manage checklists | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function ManageChecklistsPage({ searchParams }: PageProps<"/checklists/manage">) {
  const workspace = await requireWorkspace();
  if (!canManageChecklists(workspace.role)) redirect("/checklists");
  const { saved } = await searchParams;
  const { active, archived } = await getChecklists(workspace);
  const where = (locationId: string | null) =>
    locationId ? workspace.locations.find((l) => l.id === locationId)?.name ?? "Another location" : "Every location";
  const existing = new Set([...active, ...archived].map((c) => c.name.trim().toLowerCase()));
  const starters = STARTER_CHECKLISTS.filter((s) => !existing.has(s.name.toLowerCase()));

  return (
    <AppShell
      workspace={workspace}
      active="checklists"
      crumb="Manage checklists"
      topbar={<Link href="/checklists/manage/new" className="button-primary"><Plus size={15} /> New checklist</Link>}
    >
      <div className="page-content team-page">
        <Link href="/checklists" className="setup-back"><ArrowLeft size={15} /> Back to today&apos;s checklists</Link>
        <section className="team-head">
          <span className="overline"><Settings2 size={14} /> {workspace.organizationName.toUpperCase()}</span>
          <h1>Your checklists,<br /><em>your standards.</em></h1>
          <p>Build the cleaning, sanitation and maintenance routines your team follows. Changes apply from now on; past ticks are kept.</p>
        </section>

        {saved === "1" && <p className="form-notice team-notice"><CircleCheck size={16} /> Checklist saved.</p>}

        <section className="team-card" aria-labelledby="lists-title">
          <div className="section-heading compact-heading">
            <div><span className="section-eyebrow">IN USE</span><h2 id="lists-title">Checklists</h2></div>
            <span className="checklist-count">{String(active.length).padStart(2, "0")}</span>
          </div>
          {active.length === 0 ? (
            <p className="team-empty">No checklists yet. Start from a suggestion below, or create your own.</p>
          ) : (
            <ul className="service-list">
              {active.map((c) => (
                <li key={c.id}>
                  <div className="service-copy">
                    <strong>{c.name}</strong>
                    <small>{FREQUENCY_LABELS[c.frequency]} · {where(c.location_id)} · {c.tasks.length} {c.tasks.length === 1 ? "task" : "tasks"}</small>
                  </div>
                  <span />
                  <div className="member-side">
                    <Link href={`/checklists/manage/${c.id}`} className="button-quiet"><PencilLine size={14} /> Edit</Link>
                    <ActionButton action={setChecklistArchived} fields={{ checklistId: c.id, archived: "true" }} label="Retire" pendingLabel="Retiring…"
                      confirm={`Stop using "${c.name}"? Past ticks are kept, and you can bring it back.`} className="button-quiet button-quiet-danger" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <details className="archived-pets">
              <summary>{archived.length} retired {archived.length === 1 ? "checklist" : "checklists"}</summary>
              <ul className="service-list">
                {archived.map((c) => (
                  <li key={c.id} className="is-off">
                    <div className="service-copy"><strong>{c.name}</strong><small>{FREQUENCY_LABELS[c.frequency]} · {where(c.location_id)}</small></div>
                    <span />
                    <div className="member-side">
                      <ActionButton action={setChecklistArchived} fields={{ checklistId: c.id, archived: "false" }} label="Bring back" pendingLabel="Restoring…" />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {starters.length > 0 && (
          <section className="team-card starter-section" aria-labelledby="starters-title">
            <div className="section-heading compact-heading">
              <div><span className="section-eyebrow">SUGGESTIONS</span><h2 id="starters-title">Start from a template</h2></div>
              <Sparkles size={18} className="team-card-icon" />
            </div>
            <p className="team-empty">Add one, then edit the tasks to match how your salon works.</p>
            <div className="starter-grid">
              {starters.map((s) => (
                <article key={s.key} className="starter-card">
                  <strong>{s.name}</strong>
                  <small>{FREQUENCY_LABELS[s.frequency]} · {s.tasks.length} tasks</small>
                  <ul>{s.tasks.slice(0, 3).map((t) => <li key={t}>{t}</li>)}{s.tasks.length > 3 && <li>and {s.tasks.length - 3} more</li>}</ul>
                  <ActionButton action={addStarterChecklist} fields={{ starter: s.key }} label="Add this checklist" pendingLabel="Adding…" />
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
