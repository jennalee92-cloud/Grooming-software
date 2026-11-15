import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, PencilLine, Plus, Tag } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { canManageServices } from "@/lib/roles";
import { PET_SIZES, SIZE_LABELS, durationLabel, money, priceSummary, toMenuItem } from "@/lib/service-labels";
import { getServices } from "@/lib/services";
import { setServiceRetired } from "./actions";

export const metadata: Metadata = { title: "Services & prices | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const workspace = await requireWorkspace();
  const { saved, added } = await searchParams;
  const { active, retired } = await getServices(workspace);
  const canManage = canManageServices(workspace.role);

  return (
    <AppShell
      workspace={workspace}
      active="services"
      crumb="Services & prices"
      topbar={canManage ? <Link href="/services/new" className="button-primary"><Plus size={15} /> Add service</Link> : undefined}
    >
      <div className="page-content team-page">
        <section className="team-head">
          <span className="overline"><Tag size={14} /> {workspace.organizationName.toUpperCase()}</span>
          <h1>Your menu,<br /><em>your prices.</em></h1>
          <p>
            {canManage
              ? "List what you offer and what it costs. When the team records a visit, they pick from this menu and the price fills in for the pet's size."
              : "What the salon offers and what it costs. Owners, admins and managers keep this up to date."}
          </p>
        </section>

        {saved === "1" && <p className="form-notice team-notice"><CircleCheck size={16} /> Service updated.</p>}
        {added === "1" && <p className="form-notice team-notice"><CircleCheck size={16} /> Service added to the menu.</p>}

        <section className="team-card" aria-labelledby="menu-title">
          <div className="section-heading compact-heading">
            <div><span className="section-eyebrow">ON THE MENU</span><h2 id="menu-title">Services</h2></div>
            <span className="checklist-count">{String(active.length).padStart(2, "0")}</span>
          </div>

          {active.length === 0 ? (
            <p className="team-empty">
              No services yet.{" "}
              {canManage
                ? <Link href="/services/new" className="text-link">Add your first service</Link>
                : "Ask an owner or manager to set up the menu."}
            </p>
          ) : (
            <ul className="service-list">
              {active.map((s) => {
                const item = toMenuItem(s);
                return (
                  <li key={s.id}>
                    <div className="service-copy">
                      <strong>{s.name}</strong>
                      {s.description && <small>{s.description}</small>}
                      {s.duration_minutes && <small><Clock size={12} /> {durationLabel(s.duration_minutes)}</small>}
                    </div>
                    <div className="service-price">
                      {item.pricing === "flat" ? (
                        <strong>{priceSummary(item)}</strong>
                      ) : (
                        <dl className="size-prices">
                          {PET_SIZES.map((size) => (
                            <div key={size}><dt>{SIZE_LABELS[size]}</dt><dd>{money(item.sizePrices[size] ?? 0)}</dd></div>
                          ))}
                        </dl>
                      )}
                    </div>
                    {canManage && (
                      <div className="member-side">
                        <Link href={`/services/${s.id}/edit`} className="button-quiet" aria-label={`Edit ${s.name}`}><PencilLine size={14} /> Edit</Link>
                        <ActionButton
                          action={setServiceRetired}
                          fields={{ serviceId: s.id, retired: "true" }}
                          label="Retire"
                          pendingLabel="Retiring…"
                          confirm={`Take ${s.name} off the menu? Past visits keep it, and you can bring it back any time.`}
                          className="button-quiet button-quiet-danger"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {retired.length > 0 && (
            <details className="archived-pets">
              <summary>{retired.length} retired {retired.length === 1 ? "service" : "services"}</summary>
              <ul className="service-list">
                {retired.map((s) => (
                  <li key={s.id} className="is-off">
                    <div className="service-copy"><strong>{s.name}</strong><small>Not offered on new visits</small></div>
                    <div className="service-price"><strong>{priceSummary(toMenuItem(s))}</strong></div>
                    {canManage && (
                      <div className="member-side">
                        <ActionButton
                          action={setServiceRetired}
                          fields={{ serviceId: s.id, retired: "false" }}
                          label="Bring back"
                          pendingLabel="Restoring…"
                          className="button-quiet"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Development preview · Use test information only</span></footer>
      </div>
    </AppShell>
  );
}
