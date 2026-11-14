import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CircleHelp, Database, LayoutDashboard, LockKeyhole, Scissors, Settings2 } from "lucide-react";

export default function SetupPage() {
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
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-caption">Workspace</span>
          <Link className="nav-item" href="/"><LayoutDashboard size={18} /><span>Overview</span></Link>
          <Link className="nav-item active" href="/setup" aria-current="page"><Settings2 size={18} /><span>Workspace setup</span><span className="nav-count">1</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-indicator"><span className="connection-dot" />Data connection pending</div>
          <p>No customer, pet, or employee records are stored in this workspace.</p>
          <Link href="/" className="sidebar-help">Back to overview <ArrowUpRight size={14} /></Link>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>YOUR BUSINESS</span><span className="breadcrumb-divider">/</span><strong>Workspace setup</strong></div>
          <Link href="/" className="topbar-link">Overview <ArrowUpRight size={15} /></Link>
        </header>

        <div className="setup-page">
          <Link href="/" className="setup-back"><ArrowLeft size={15} /> Back to overview</Link>
          <span className="overline setup-overline"><Database size={14} /> SECURE FOUNDATION · STEP 1</span>
          <h1>Give your records<br /><em>a safe home.</em></h1>
          <p className="setup-lede">Before adding business information, connect a Supabase project. The app does not have a database connection yet, and this preview does not save customer or pet data.</p>

          <section className="connection-panel" aria-labelledby="connection-title">
            <div className="connection-panel-icon"><LockKeyhole size={21} /></div>
            <div>
              <div className="setup-title-row"><h2 id="connection-title">Database connection</h2><span className="setup-status">Not configured</span></div>
              <p>When your project is ready, add its URL and public anon key to <code>web/.env.local</code>. Never expose a service-role key in the browser or commit it to Git.</p>
            </div>
          </section>

          <div className="setup-steps" aria-label="Database setup steps">
            <div className="setup-step">
              <span className="setup-step-number">01</span>
              <div><h3>Create or locate your Supabase project</h3><p>Check whether you already have a project for Grooming Desk. If not, create one in your Supabase account. Keep its credentials private.</p></div>
              <a className="step-label step-external" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">OPEN SUPABASE <ArrowUpRight size={12} /></a>
            </div>
            <div className="setup-step">
              <span className="setup-step-number">02</span>
              <div><h3>Configure the local app</h3><p>Copy <code>web/.env.example</code> to <code>web/.env.local</code> and fill in the project URL and public anon key from Supabase settings.</p></div>
              <span className="step-label">AFTER STEP 1</span>
            </div>
            <div className="setup-step">
              <span className="setup-step-number">03</span>
              <div><h3>Apply and verify tenant security</h3><p>Next, we will add the database schema and row-level security policies, then test that one business cannot access another business&apos;s records.</p></div>
              <span className="step-label">BEFORE REAL DATA</span>
            </div>
          </div>

          <div className="setup-note"><CircleHelp size={16} /><span>Not sure whether you have a project? You can check the Supabase dashboard first. Do not send passwords, secret keys, or service-role credentials in chat.</span></div>

          <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Setup progress is not saved yet</span></footer>
        </div>
      </main>
    </div>
  );
}