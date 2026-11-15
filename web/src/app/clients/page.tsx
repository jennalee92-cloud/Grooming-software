import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Dog, Plus, Search, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { clientName, searchClients } from "@/lib/clients";
import { requireWorkspace } from "@/lib/dal";
import { canEditClients } from "@/lib/roles";

export const metadata: Metadata = { title: "Clients & pets | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const workspace = await requireWorkspace();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const showArchived = params.archived === "1";
  const results = await searchClients(workspace, query, showArchived);
  const canEdit = canEditClients(workspace.role);

  return (
    <AppShell workspace={workspace} active="clients" crumb="Clients & pets"
      topbar={canEdit ? <Link href="/clients/new" className="button-primary topbar-button"><Plus size={15} /> Add client</Link> : undefined}>
      <div className="page-content">
        <section className="team-head">
          <span className="overline"><Dog size={14} /> {workspace.organizationName.toUpperCase()}</span>
          <h1>Clients <em>&amp; pets.</em></h1>
          <p>Every household and the pets that belong to it. Search by a person&apos;s name, phone number or email, or by a pet&apos;s name.</p>
        </section>

        <form className="client-search" role="search" action="/clients">
          <label className="client-search-box" htmlFor="client-q">
            <Search size={17} />
            <span className="sr-only">Search clients and pets</span>
            <input id="client-q" name="q" type="search" defaultValue={query} maxLength={100}
              placeholder="Search name, phone, email or pet" autoComplete="off" />
          </label>
          <label className="check-inline">
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} /> Include archived
          </label>
          <button type="submit" className="button-primary">Search</button>
        </form>

        <section className="team-card client-results" aria-label="Clients">
          {results.length === 0 ? (
            <div className="empty-state">
              <Dog size={26} strokeWidth={1.5} />
              {query ? (
                <p>No clients match &ldquo;{query}&rdquo;.{canEdit && <> <Link href="/clients/new" className="text-link">Add a new client</Link></>}</p>
              ) : (
                <p>No clients yet.{canEdit && <> <Link href="/clients/new" className="text-link">Add your first client</Link> to start building your records.</>}</p>
              )}
            </div>
          ) : (
            <>
              <div className="results-count">{results.length === 200 ? "Showing the first 200 matches. Search to narrow it down." : `${results.length} ${results.length === 1 ? "household" : "households"}`}</div>
              <ul className="client-list">
                {results.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className={`client-row${c.archived ? " is-off" : ""}`}>
                      <span className="member-avatar">{(c.lastName || c.firstName).charAt(0).toUpperCase()}</span>
                      <span className="member-copy">
                        <strong>{clientName(c)}{c.archived && <span className="status-chip status-chip-inline">Archived</span>}</strong>
                        <small>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details yet"}</small>
                        {c.pets.length > 0 && (
                          <span className="pet-chips">
                            {c.pets.map((p) => (
                              <span key={p.id} className={`pet-chip${p.handle_with_care ? " is-caution" : ""}`}>
                                {p.handle_with_care && <TriangleAlert size={12} aria-label="Handle with care" />}
                                {p.name}{p.breed ? <em> · {p.breed}</em> : null}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={17} className="row-chevron" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <footer className="page-footer"><span>GROOMING DESK <span className="footer-separator">/</span> A BETTER-RUN DAY</span><span>Development preview · Use test information only</span></footer>
      </div>
    </AppShell>
  );
}
