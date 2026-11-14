import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, CircleHelp, MapPin, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ROLE_LABELS, requireWorkspace } from "@/lib/dal";

export const metadata: Metadata = { title: "Workspace setup | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function SetupPage() {
  const workspace = await requireWorkspace();

  return (
    <AppShell workspace={workspace} active="setup" crumb="Workspace setup">
      <div className="setup-page">
        <Link href="/" className="setup-back"><ArrowLeft size={15} /> Back to overview</Link>
        <span className="overline setup-overline"><ShieldCheck size={14} /> SECURE FOUNDATION</span>
        <h1>Your workspace,<br /><em>set up safely.</em></h1>
        <p className="setup-lede">{workspace.organizationName} has its own private workspace. The database only shows its records to people who belong to it, and every change is logged.</p>

        <section className="connection-panel" aria-labelledby="locations-title">
          <div className="connection-panel-icon"><MapPin size={21} /></div>
          <div>
            <div className="setup-title-row"><h2 id="locations-title">Locations</h2><span className="setup-status is-done">{workspace.locations.length} active</span></div>
            <ul className="location-list">
              {workspace.locations.map((l) => (
                <li key={l.id}><strong>{l.name}</strong><span>{l.timezone.replace(/_/g, " ")}</span></li>
              ))}
            </ul>
            <p>You&apos;re signed in as <strong>{ROLE_LABELS[workspace.role]}</strong>. Adding and editing locations from here is coming with team management.</p>
          </div>
        </section>

        <div className="setup-steps" aria-label="Setup steps">
          <div className="setup-step is-done">
            <span className="setup-step-number"><Check size={14} /></span>
            <div><h3>Secure database connected</h3><p>Privacy rules on every table, checked by automated tests before each change.</p></div>
            <span className="step-label">DONE</span>
          </div>
          <div className="setup-step is-done">
            <span className="setup-step-number"><Check size={14} /></span>
            <div><h3>Business and first location created</h3><p>You&apos;re the owner of {workspace.organizationName}.</p></div>
            <span className="step-label">DONE</span>
          </div>
          <div className="setup-step">
            <span className="setup-step-number">03</span>
            <div><h3>Invite your team</h3><p>Send invitations by email, choose each person&apos;s role, and pick which locations they can see.</p></div>
            <span className="step-label">COMING NEXT</span>
          </div>
        </div>

        <div className="setup-note"><CircleHelp size={16} /><span>This is a development version. Use test information only, not real customer, pet, or employee details.</span></div>

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Phase 1 · Secure foundation</span></footer>
      </div>
    </AppShell>
  );
}
