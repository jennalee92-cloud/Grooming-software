import Link from "next/link";
import {
  ArrowUpRight,
  ChevronsUpDown,
  ClipboardCheck,
  Dog,
  FileText,
  LayoutDashboard,
  LogOut,
  Scissors,
  Settings2,
  Tag,
  Users,
} from "lucide-react";
import { logOut } from "@/app/(auth)/actions";
import { switchWorkspace } from "@/app/workspace-actions";
import { getWorkspaces, ROLE_LABELS, type Workspace } from "@/lib/dal";

type Props = {
  workspace: Workspace;
  active: "overview" | "clients" | "services" | "team" | "setup";
  crumb: string;
  topbar?: React.ReactNode;
  children: React.ReactNode;
};

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || "G";

export async function AppShell({ workspace, active, crumb, topbar, children }: Props) {
  const others = (await getWorkspaces()).filter((w) => w.organizationId !== workspace.organizationId);

  const current = (
    <>
      <span className="workspace-avatar">{initialOf(workspace.organizationName)}</span>
      <span className="workspace-copy">
        <strong>{workspace.organizationName}</strong>
        <small>{ROLE_LABELS[workspace.role]} account</small>
      </span>
    </>
  );

  const navLink = (key: Props["active"], href: string, icon: React.ReactNode, label: string) => (
    <Link className={`nav-item${active === key ? " active" : ""}`} href={href} aria-current={active === key ? "page" : undefined}>
      {icon}<span>{label}</span>
    </Link>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Grooming Desk home">
          <span className="brand-mark"><Scissors size={19} strokeWidth={1.8} /></span>
          <span className="brand-name">grooming<span>desk</span></span>
        </Link>

        {others.length === 0 ? (
          <div className="workspace-switcher">{current}</div>
        ) : (
          <details className="workspace-menu">
            <summary className="workspace-switcher" aria-label="Switch business">
              {current}
              <ChevronsUpDown size={15} className="workspace-chevron" />
            </summary>
            <div className="workspace-options">
              <span className="nav-caption">Switch to</span>
              {others.map((w) => (
                <form key={w.organizationId} action={switchWorkspace}>
                  <input type="hidden" name="organizationId" value={w.organizationId} />
                  <button type="submit" className="workspace-option">
                    <span className="workspace-avatar">{initialOf(w.organizationName)}</span>
                    <span className="workspace-copy">
                      <strong>{w.organizationName}</strong>
                      <small>{ROLE_LABELS[w.role]}</small>
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </details>
        )}

        <nav className="side-nav" aria-label="Main navigation">
          <span className="nav-caption">Workspace</span>
          {navLink("overview", "/", <LayoutDashboard size={18} />, "Overview")}
          {navLink("clients", "/clients", <Dog size={18} />, "Clients & pets")}
          {navLink("services", "/services", <Tag size={18} />, "Services & prices")}
          {navLink("team", "/team", <Users size={18} />, "Team")}
          {navLink("setup", "/setup", <Settings2 size={18} />, "Workspace setup")}
          <span className="nav-caption nav-caption-spaced">Coming into focus</span>
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
