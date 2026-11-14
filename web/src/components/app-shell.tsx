import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Dog, FileText, LayoutDashboard, LogOut, Scissors, Settings2 } from "lucide-react";
import { logOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, type Workspace } from "@/lib/dal";

type Props = {
  workspace: Workspace;
  active: "overview" | "setup";
  crumb: string;
  topbar?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ workspace, active, crumb, topbar, children }: Props) {
  const initial = workspace.organizationName.trim().charAt(0).toUpperCase() || "G";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Grooming Desk home">
          <span className="brand-mark"><Scissors size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">grooming<span>desk</span></span>
        </Link>

        <div className="workspace-switcher">
          <span className="workspace-avatar">{initial}</span>
          <span className="workspace-copy">
            <strong>{workspace.organizationName}</strong>
            <small>{ROLE_LABELS[workspace.role]} account</small>
          </span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-caption">Workspace</span>
          <Link className={`nav-item${active === "overview" ? " active" : ""}`} href="/" aria-current={active === "overview" ? "page" : undefined}>
            <LayoutDashboard size={18} /><span>Overview</span>
          </Link>
          <Link className={`nav-item${active === "setup" ? " active" : ""}`} href="/setup" aria-current={active === "setup" ? "page" : undefined}>
            <Settings2 size={18} /><span>Workspace setup</span>
          </Link>
          <span className="nav-caption nav-caption-spaced">Coming into focus</span>
          <div className="nav-preview"><Dog size={18} /><span>Clients &amp; pets</span></div>
          <div className="nav-preview"><ClipboardCheck size={18} /><span>Daily operations</span></div>
          <div className="nav-preview"><FileText size={18} /><span>Resources</span></div>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-indicator is-connected"><span className="connection-dot" />Secure connection</div>
          <p>Your records are private to {workspace.organizationName}.</p>
          <form action={logOut}>
            <button type="submit" className="sidebar-help link-button"><LogOut size={14} /> Log out</button>
          </form>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{workspace.organizationName.toUpperCase()}</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{crumb}</strong>
          </div>
          {topbar ?? (
            <Link href="/setup" className="topbar-link">Workspace setup <ArrowUpRight size={15} /></Link>
          )}
        </header>
        {children}
      </main>
    </div>
  );
}
