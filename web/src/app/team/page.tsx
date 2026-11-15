import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, Lock, MailPlus, PencilLine, Users } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { CopyButton } from "@/components/copy-button";
import { requireWorkspace } from "@/lib/dal";
import { shortDate } from "@/lib/format";
import { ROLE_LABELS, assignableRoles, canManageTeam } from "@/lib/roles";
import { inviteLink, siteOrigin } from "@/lib/site";
import { cancelInvitation } from "./actions";
import { InviteForm } from "./invite-form";
import { getOpenInvitations, getTeam, locationSummary } from "./team-data";

export const metadata: Metadata = { title: "Team | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

const initialOf = (text: string) => text.trim().charAt(0).toUpperCase() || "?";

export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const workspace = await requireWorkspace();
  const { saved } = await searchParams;

  if (!canManageTeam(workspace.role)) {
    return (
      <AppShell workspace={workspace} active="team" crumb="Team">
        <div className="setup-page">
          <span className="overline setup-overline"><Users size={14} /> TEAM</span>
          <h1>Your team,<br /><em>managed by the owner.</em></h1>
          <div className="connection-panel">
            <div className="connection-panel-icon"><Lock size={21} /></div>
            <div>
              <h2>Owners and admins manage the team</h2>
              <p>You&apos;re signed in as {ROLE_LABELS[workspace.role]}. If your role or locations need to change, ask the owner of {workspace.organizationName}.</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const timeZone = workspace.locations[0]?.timezone;
  const [team, invitations, origin] = await Promise.all([getTeam(workspace), getOpenInvitations(workspace), siteOrigin()]);
  const activeCount = team.filter((m) => m.active).length;

  return (
    <AppShell workspace={workspace} active="team" crumb="Team">
      <div className="page-content team-page">
        <section className="team-head">
          <span className="overline"><Users size={14} /> {workspace.organizationName.toUpperCase()}</span>
          <h1>Your team,<br /><em>your call.</em></h1>
          <p>Invite people, choose each person&apos;s role, and decide which locations they can see. Changes take effect the moment you save them.</p>
        </section>

        {saved === "1" && <p className="form-notice team-notice"><CircleCheck size={16} /> Changes saved.</p>}

        <div className="team-grid">
          <section className="team-card" aria-labelledby="invite-title">
            <div className="section-heading compact-heading">
              <div><span className="section-eyebrow">ADD SOMEONE</span><h2 id="invite-title">Invite a teammate</h2></div>
              <MailPlus size={18} className="team-card-icon" />
            </div>
            <InviteForm roles={assignableRoles(workspace.role)} locations={workspace.locations} />
          </section>

          <div className="team-column">
            <section className="team-card" aria-labelledby="members-title">
              <div className="section-heading compact-heading">
                <div><span className="section-eyebrow">ON THE TEAM</span><h2 id="members-title">People</h2></div>
                <span className="checklist-count">{String(activeCount).padStart(2, "0")} <span>active</span></span>
              </div>
              <ul className="member-list">
                {team.map((m) => (
                  <li key={m.memberId} className={m.active ? undefined : "is-off"}>
                    <span className="member-avatar">{initialOf(m.displayName ?? m.email)}</span>
                    <span className="member-copy">
                      <strong>{m.displayName ?? m.email}{m.isYou && <em className="you-tag">you</em>}</strong>
                      {m.displayName && <small>{m.email}</small>}
                      <small>{ROLE_LABELS[m.role]} · {locationSummary(m, workspace.locations)}</small>
                    </span>
                    <span className="member-side">
                      {!m.active && <span className="status-chip">Access off</span>}
                      {m.canEdit && (
                        <Link href={`/team/${m.memberId}`} className="button-quiet" aria-label={`Edit ${m.displayName ?? m.email}`}>
                          <PencilLine size={14} /> Edit
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="team-card" aria-labelledby="pending-title">
              <div className="section-heading compact-heading">
                <div><span className="section-eyebrow">WAITING TO JOIN</span><h2 id="pending-title">Open invitations</h2></div>
                <span className="checklist-count">{String(invitations.length).padStart(2, "0")}</span>
              </div>
              {invitations.length === 0 ? (
                <p className="team-empty">No open invitations. New ones show up here until the person accepts.</p>
              ) : (
                <ul className="member-list">
                  {invitations.map((i) => (
                    <li key={i.id} className={i.expired ? "is-off" : undefined}>
                      <span className="member-avatar member-avatar-pending"><Clock size={15} /></span>
                      <span className="member-copy">
                        <strong>{i.displayName ?? i.email}</strong>
                        {i.displayName && <small>{i.email}</small>}
                        <small>
                          {ROLE_LABELS[i.role]} · {locationSummary(i, workspace.locations)} ·{" "}
                          {i.expired ? "expired, invite again to renew" : `open until ${shortDate(i.expiresAt, timeZone)}`}
                        </small>
                      </span>
                      <span className="member-side">
                        {!i.expired && <CopyButton text={inviteLink(origin, i.email)} />}
                        {i.canCancel && (
                          <ActionButton
                            action={cancelInvitation}
                            fields={{ invitationId: i.id }}
                            label="Cancel"
                            pendingLabel="Cancelling…"
                            confirm={`Cancel the invitation for ${i.email}?`}
                            className="button-quiet button-quiet-danger"
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Development preview · Use test information only</span></footer>
      </div>
    </AppShell>
  );
}
