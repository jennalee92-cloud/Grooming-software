import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Power, UserRound } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { ROLE_LABELS, assignableRoles, canManageTeam } from "@/lib/roles";
import { setMemberAccess } from "../actions";
import { getTeam } from "../team-data";
import { MemberForm } from "./member-form";

export const metadata: Metadata = { title: "Edit team member | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function MemberPage({ params }: PageProps<"/team/[memberId]">) {
  const { memberId } = await params;
  const workspace = await requireWorkspace();
  if (!UUID_PATTERN.test(memberId) || !canManageTeam(workspace.role)) notFound();

  const member = (await getTeam(workspace)).find((m) => m.memberId === memberId);
  if (!member) notFound();
  const name = member.displayName ?? member.email;

  return (
    <AppShell workspace={workspace} active="team" crumb="Team">
      <div className="setup-page">
        <Link href="/team" className="setup-back"><ArrowLeft size={15} /> Back to team</Link>
        <span className="overline setup-overline"><UserRound size={14} /> {ROLE_LABELS[member.role].toUpperCase()}</span>
        <h1>{name}</h1>
        {member.displayName && <p className="setup-lede">{member.email}</p>}

        {!member.canEdit ? (
          <section className="connection-panel">
            <div className="connection-panel-icon"><Lock size={21} /></div>
            <div>
              <h2>You can&apos;t change this person</h2>
              <p>
                {member.isYou ? "Nobody can change their own role or access." :
                  member.role === "owner" ? "The owner's role and access can't be changed." :
                  "Only the owner can change an admin's role or access."}
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className="team-card member-edit" aria-labelledby="access-title">
              <div className="section-heading compact-heading">
                <div><span className="section-eyebrow">ROLE AND LOCATIONS</span><h2 id="access-title">What they can see</h2></div>
              </div>
              {member.active ? (
                <MemberForm
                  memberId={member.memberId}
                  roles={assignableRoles(workspace.role)}
                  locations={workspace.locations}
                  role={member.role}
                  allLocations={member.allLocations}
                  locationIds={member.locationIds}
                />
              ) : (
                <p className="team-empty">Turn their access back on to change their role or locations.</p>
              )}
            </section>

            <section className="connection-panel" aria-labelledby="power-title">
              <div className="connection-panel-icon"><Power size={21} /></div>
              <div>
                <h2 id="power-title">{member.active ? "Turn off access" : "Access is off"}</h2>
                <p>
                  {member.active
                    ? `${name} will lose access to ${workspace.organizationName} right away. Their name stays on past records, and you can turn access back on later.`
                    : `${name} can't see ${workspace.organizationName}. Turning access back on restores their previous role and locations.`}
                </p>
                <div className="panel-actions">
                  <ActionButton
                    action={setMemberAccess}
                    fields={{ memberId: member.memberId, active: member.active ? "false" : "true" }}
                    label={member.active ? "Turn off access" : "Turn access back on"}
                    pendingLabel="Saving…"
                    confirm={member.active ? `Turn off ${name}'s access to ${workspace.organizationName}?` : undefined}
                    className={member.active ? "button-quiet button-quiet-danger" : "button-quiet"}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
