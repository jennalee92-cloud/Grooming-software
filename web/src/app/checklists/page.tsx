import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, MapPin, Settings2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FREQUENCY_LABELS, PERIOD_LABELS, periodStart, type ChecklistFrequency } from "@/lib/checklist-labels";
import { getChecklistsAt } from "@/lib/checklists";
import { requireWorkspace } from "@/lib/dal";
import { dayLabel } from "@/lib/format";
import { canManageChecklists } from "@/lib/roles";
import { getTeamOptions, todayIn } from "@/lib/visits";
import { TaskToggle } from "./task-toggle";

export const metadata: Metadata = { title: "Checklists | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

const ORDER: ChecklistFrequency[] = ["daily", "weekly", "monthly"];

export default async function ChecklistsPage({ searchParams }: PageProps<"/checklists">) {
  const workspace = await requireWorkspace();
  const { location: chosen } = await searchParams;
  const location = workspace.locations.find((l) => l.id === chosen) ?? workspace.locations[0];
  const canManage = canManageChecklists(workspace.role);

  if (!location) {
    return (
      <AppShell workspace={workspace} active="checklists" crumb="Checklists">
        <div className="setup-page"><p className="team-empty">You don&apos;t have access to any locations yet. Ask an owner or admin to add you to one.</p></div>
      </AppShell>
    );
  }

  const today = todayIn(location.timezone);
  const [{ lists, ticks }, team] = await Promise.all([getChecklistsAt(workspace, location.id, today), getTeamOptions(workspace)]);
  const nameOf = new Map(team.map((m) => [m.userId, m.label.replace(" (you)", "")]));
  const time = (iso: string, withDay: boolean) =>
    new Date(iso).toLocaleString("en-US", { timeZone: location.timezone, hour: "numeric", minute: "2-digit", ...(withDay ? { weekday: "short" } : {}) });

  return (
    <AppShell
      workspace={workspace}
      active="checklists"
      crumb="Checklists"
      topbar={canManage ? <Link href="/checklists/manage" className="button-quiet"><Settings2 size={14} /> Manage checklists</Link> : undefined}
    >
      <div className="page-content team-page">
        <section className="team-head">
          <span className="overline"><ClipboardCheck size={14} /> {dayLabel(today).toUpperCase()}</span>
          <h1>Today&apos;s<br /><em>checklists.</em></h1>
          <p>Tick each task when it&apos;s done. Lists start fresh each day, week or month, and every tick is kept with who did it.</p>
        </section>

        {workspace.locations.length > 1 && (
          <nav className="location-tabs" aria-label="Location">
            {workspace.locations.map((l) => (
              <Link key={l.id} href={`/checklists?location=${l.id}`} className={l.id === location.id ? "is-active" : undefined}
                aria-current={l.id === location.id ? "page" : undefined}>
                <MapPin size={13} /> {l.name}
              </Link>
            ))}
          </nav>
        )}

        {lists.length === 0 ? (
          <section className="team-card">
            <p className="team-empty">
              No checklists yet.{" "}
              {canManage
                ? <Link href="/checklists/manage" className="text-link">Set up your checklists</Link>
                : "An owner or manager can set them up."}
            </p>
          </section>
        ) : (
          ORDER.map((freq) => {
            const group = lists.filter((c) => c.frequency === freq);
            if (group.length === 0) return null;
            return (
              <section key={freq} className="checklist-group" aria-labelledby={`group-${freq}`}>
                <h2 id={`group-${freq}`} className="section-eyebrow">{PERIOD_LABELS[freq].toUpperCase()} · {FREQUENCY_LABELS[freq].toUpperCase()}</h2>
                <div className="checklist-cards">
                  {group.map((c) => {
                    const period = periodStart(c.frequency, today);
                    const done = c.tasks.filter((t) => ticks.has(t.id)).length;
                    const complete = done === c.tasks.length;
                    return (
                      <article key={c.id} className={`team-card checklist-card${complete ? " is-complete" : ""}`}>
                        <div className="checklist-card-head">
                          <div>
                            <h3>{c.name}</h3>
                            {c.description && <small>{c.description}</small>}
                          </div>
                          <span className="checklist-progress" aria-label={`${done} of ${c.tasks.length} done`}>
                            {done}/{c.tasks.length}
                          </span>
                        </div>
                        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${(done / c.tasks.length) * 100}%` }} /></div>
                        <div className="task-list">
                          {c.tasks.map((t) => {
                            const tick = ticks.get(t.id);
                            return (
                              <TaskToggle
                                key={t.id}
                                taskId={t.id}
                                locationId={location.id}
                                periodStart={period}
                                label={t.label}
                                details={t.details}
                                checked={Boolean(tick)}
                                doneBy={tick ? `${(tick.checkedBy && nameOf.get(tick.checkedBy)) ?? "a former team member"} · ${time(tick.checkedAt, freq !== "daily")}` : null}
                              />
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Development preview · Use test information only</span></footer>
      </div>
    </AppShell>
  );
}
