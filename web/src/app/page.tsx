import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Dog,
  FileText,
  LockKeyhole,
  MapPin,
  Scissors,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function Home() {
  const workspace = await requireWorkspace();
  const firstName = workspace.displayName?.split(" ")[0];
  const locationCount = workspace.locations.length;

  return (
    <AppShell workspace={workspace} active="overview" crumb="Overview">
      <div className="page-content">
        <section className="welcome-row">
          <div className="welcome-copy">
            <span className="overline"><Sparkles size={14} /> {workspace.organizationName.toUpperCase()}</span>
            <h1>{firstName ? <>Welcome, {firstName}.<br /></> : <>Welcome in.<br /></>}<em>Your desk is ready.</em></h1>
            <p>Your workspace is set up and private to your business. Next, you&apos;ll be able to invite your team and choose which locations each person works at.</p>
          </div>
          <div className="welcome-art" aria-label="Grooming Desk illustration" role="img">
            <div className="art-ring art-ring-one" />
            <div className="art-ring art-ring-two" />
            <span className="art-index">FIELD NOTE <b>002</b></span>
            <div className="art-paper"><Scissors size={30} strokeWidth={1.25} /><span>Good work<br />starts with<br /><i>good care.</i></span></div>
            <span className="art-sparkle">✳</span>
            <span className="art-foot">GROOMING DESK / 2026</span>
          </div>
        </section>

        <section className="setup-banner" aria-labelledby="setup-title">
          <div className="setup-icon"><Users size={22} strokeWidth={1.7} /></div>
          <div className="setup-message">
            <div className="setup-title-row"><span className="setup-kicker">FOUNDATION · STEP 3 OF 3</span><span className="setup-status">Coming next</span></div>
            <h2 id="setup-title">Invite your team.</h2>
            <p>Staff invitations, roles, and location access are the next part being built.</p>
          </div>
          <Link href="/setup" className="button-primary">View setup <ArrowRight size={16} /></Link>
        </section>

        <section className="overview-section" aria-labelledby="overview-title">
          <div className="section-heading">
            <div><span className="section-eyebrow">A CLEAR VIEW OF THE DAY</span><h2 id="overview-title">Your overview</h2></div>
            <span className="section-note"><LockKeyhole size={14} /> Visit and pet numbers arrive with client records</span>
          </div>
          <div className="metric-grid">
            <article className="metric-card metric-card-sage"><div className="metric-label"><MapPin size={16} /><span>Locations</span></div><div className="metric-value">{locationCount}</div><div className="metric-foot">{workspace.locations.map((l) => l.name).join(" · ")}</div></article>
            <article className="metric-card metric-card-rose"><div className="metric-label"><Dog size={16} /><span>Pets on file</span></div><div className="metric-value">--</div><div className="metric-foot">Profiles stay with their people</div></article>
            <article className="metric-card metric-card-lime"><div className="metric-label"><CalendarDays size={16} /><span>Today&apos;s visits</span></div><div className="metric-value">--</div><div className="metric-foot">Visit history comes with pet profiles</div></article>
          </div>
        </section>

        <section className="bottom-grid" aria-label="Workspace setup details">
          <article className="launch-card">
            <div className="section-heading compact-heading"><div><span className="section-eyebrow">THE FIRST MILE</span><h2>Workspace checklist</h2></div><span className="checklist-count">02 <span>/ 03</span></span></div>
            <ol className="checklist">
              <li className="checklist-done"><span className="check-number">01</span><span className="check-copy"><strong>Create your account</strong><small>Email confirmed</small></span><span className="check-done"><Check size={14} /></span></li>
              <li className="checklist-done"><span className="check-number">02</span><span className="check-copy"><strong>Set up your business</strong><small>{workspace.organizationName} · {locationCount} {locationCount === 1 ? "location" : "locations"}</small></span><span className="check-done"><Check size={14} /></span></li>
              <li className="checklist-current"><span className="check-number">03</span><span className="check-copy"><strong>Invite your team</strong><small>Roles and location access</small></span><span className="check-state">SOON</span></li>
            </ol>
            <Link href="/setup" className="text-link">See workspace setup <ArrowRight size={15} /></Link>
          </article>

          <article className="history-card">
            <div className="section-heading compact-heading"><div><span className="section-eyebrow">RECENT ACTIVITY</span><h2>Recorded for you.</h2></div><span className="activity-mark"><span /></span></div>
            <div className="activity-empty"><div className="activity-icon"><FileText size={20} strokeWidth={1.6} /></div><p>Every change in your workspace is already logged with who made it and when. An activity view for owners and admins is on the way.</p></div>
            <div className="history-foot"><span>ACTIVITY HISTORY</span><span><ClipboardCheck size={11} /> Logging on</span></div>
          </article>
        </section>

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Development preview · Use test information only</span></footer>
      </div>
    </AppShell>
  );
}
