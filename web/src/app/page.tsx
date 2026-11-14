import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  Dog,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Scissors,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Grooming Desk home">
          <span className="brand-mark"><Scissors size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">grooming<span>desk</span></span>
        </Link>

        <div className="workspace-switcher">
          <span className="workspace-avatar">G</span>
          <span className="workspace-copy"><strong>Your workspace</strong><small>Owner account</small></span>
          <ArrowDownRight className="workspace-chevron" size={15} />
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-caption">Workspace</span>
          <Link className="nav-item active" href="/" aria-current="page">
            <LayoutDashboard size={18} /><span>Overview</span>
          </Link>
          <Link className="nav-item" href="/setup">
            <Settings2 size={18} /><span>Workspace setup</span><span className="nav-count">1</span>
          </Link>
          <span className="nav-caption nav-caption-spaced">Coming into focus</span>
          <div className="nav-preview"><Dog size={18} /><span>Clients &amp; pets</span></div>
          <div className="nav-preview"><ClipboardCheck size={18} /><span>Daily operations</span></div>
          <div className="nav-preview"><FileText size={18} /><span>Resources</span></div>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-indicator"><span className="connection-dot" />Data connection pending</div>
          <p>Your workspace is not storing business records yet.</p>
          <Link href="/setup" className="sidebar-help">Review setup <ArrowUpRight size={14} /></Link>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>YOUR BUSINESS</span><span className="breadcrumb-divider">/</span><strong>Overview</strong></div>
          <Link href="/setup" className="topbar-link"><span className="topbar-dot" />Setup in progress <ArrowUpRight size={15} /></Link>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div className="welcome-copy">
              <span className="overline"><Sparkles size={14} /> YOUR OPERATIONS, IN ONE PLACE</span>
              <h1>A steadier day<br /><em>starts here.</em></h1>
              <p>A considered home for the details that keep your grooming business moving. First, let&apos;s secure your workspace.</p>
            </div>
            <div className="welcome-art" aria-label="Grooming Desk workspace setup illustration" role="img">
              <div className="art-ring art-ring-one" />
              <div className="art-ring art-ring-two" />
              <span className="art-index">FIELD NOTE <b>001</b></span>
              <div className="art-paper"><Scissors size={30} strokeWidth={1.25} /><span>Good work<br />starts with<br /><i>good care.</i></span></div>
              <span className="art-sparkle">✳</span>
              <span className="art-foot">GROOMING DESK / 2026</span>
            </div>
          </section>

          <section className="setup-banner" aria-labelledby="setup-title">
            <div className="setup-icon"><ShieldCheck size={22} strokeWidth={1.7} /></div>
            <div className="setup-message">
              <div className="setup-title-row"><span className="setup-kicker">FOUNDATION · STEP 1 OF 3</span><span className="setup-status">Not connected</span></div>
              <h2 id="setup-title">Secure your workspace before adding records.</h2>
              <p>Connect a Supabase project so customer, pet, and employee information has a protected home.</p>
            </div>
            <Link href="/setup" className="button-primary">Open setup <ArrowRight size={16} /></Link>
          </section>

          <section className="overview-section" aria-labelledby="overview-title">
            <div className="section-heading">
              <div><span className="section-eyebrow">A CLEAR VIEW OF THE DAY</span><h2 id="overview-title">Your overview</h2></div>
              <span className="section-note"><LockKeyhole size={14} /> Live information appears after connection</span>
            </div>
            <div className="metric-grid">
              <article className="metric-card metric-card-sage"><div className="metric-label"><CalendarDays size={16} /><span>Today&apos;s visits</span></div><div className="metric-value">--</div><div className="metric-foot">Appointments will appear here</div></article>
              <article className="metric-card metric-card-rose"><div className="metric-label"><Dog size={16} /><span>Pets on file</span></div><div className="metric-value">--</div><div className="metric-foot">Profiles stay with their people</div></article>
              <article className="metric-card metric-card-lime"><div className="metric-label"><ClipboardCheck size={16} /><span>Needs attention</span></div><div className="metric-value">--</div><div className="metric-foot">Alerts will be permission-aware</div></article>
            </div>
          </section>

          <section className="bottom-grid" aria-label="Workspace setup details">
            <article className="launch-card">
              <div className="section-heading compact-heading"><div><span className="section-eyebrow">THE FIRST MILE</span><h2>Workspace checklist</h2></div><span className="checklist-count">01 <span>/ 03</span></span></div>
              <ol className="checklist">
                <li className="checklist-current"><span className="check-number">01</span><span className="check-copy"><strong>Connect a secure database</strong><small>Supabase project and local configuration</small></span><span className="check-state">NEXT</span></li>
                <li><span className="check-number">02</span><span className="check-copy"><strong>Set up your business</strong><small>Organization, location, and owner access</small></span><span className="check-lock"><LockKeyhole size={14} /></span></li>
                <li><span className="check-number">03</span><span className="check-copy"><strong>Add your first client</strong><small>Then build each pet&apos;s permanent profile</small></span><span className="check-lock"><LockKeyhole size={14} /></span></li>
              </ol>
              <Link href="/setup" className="text-link">Continue setup <ArrowRight size={15} /></Link>
            </article>

            <article className="history-card">
              <div className="section-heading compact-heading"><div><span className="section-eyebrow">RECENT ACTIVITY</span><h2>Nothing to catch up on.</h2></div><span className="activity-mark"><span /></span></div>
              <div className="activity-empty"><div className="activity-icon"><FileText size={20} strokeWidth={1.6} /></div><p>Once connected, important changes and completed work will be recorded here with who made them and when.</p></div>
              <div className="history-foot"><span>ACTIVITY HISTORY</span><span>Ready when you are</span></div>
            </article>
          </section>

          <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Workspace preview · No business data stored</span></footer>
        </div>
      </main>
    </div>
  );
}
