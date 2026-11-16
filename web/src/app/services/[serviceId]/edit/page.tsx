import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { UUID_PATTERN } from "@/lib/db-errors";
import { canManageServices } from "@/lib/roles";
import { moneyInput } from "@/lib/service-labels";
import { getServices } from "@/lib/services";
import { ServiceForm } from "../../service-form";

export const metadata: Metadata = { title: "Edit service | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function EditServicePage({ params, searchParams }: PageProps<"/services/[serviceId]/edit">) {
  const { serviceId } = await params;
  const { breedError } = await searchParams;
  const workspace = await requireWorkspace();
  if (!canManageServices(workspace.role)) redirect("/services");
  if (!UUID_PATTERN.test(serviceId)) notFound();

  const { active, retired, breedPrices } = await getServices(workspace);
  const s = [...active, ...retired].find((x) => x.id === serviceId);
  if (!s) notFound();
  const breedDefaults = Object.fromEntries((breedPrices.get(s.id) ?? []).flatMap((b, n) => [
    [`breed_${n}`, b.breed],
    [`breedPrice_${n}`, moneyInput(b.price_cents)],
  ]));

  return (
    <AppShell workspace={workspace} active="services" crumb="Edit service">
      <div className="setup-page">
        <Link href="/services" className="setup-back"><ArrowLeft size={15} /> Back to services</Link>
        <span className="overline setup-overline"><Tag size={14} /> EDIT SERVICE</span>
        <h1>Edit<br /><em>{s.name}.</em></h1>
        {breedError === "1" && <p className="form-error" role="alert">The service was added, but its breed prices couldn&apos;t be saved. Check them below and save again.</p>}
        <section className="team-card member-edit">
          <ServiceForm
            serviceId={s.id}
            defaults={{
              name: s.name,
              description: s.description ?? "",
              durationMinutes: s.duration_minutes === null ? "" : String(s.duration_minutes),
              pricing: s.pricing,
              price: moneyInput(s.price_cents),
              smallPrice: moneyInput(s.small_price_cents),
              mediumPrice: moneyInput(s.medium_price_cents),
              largePrice: moneyInput(s.large_price_cents),
              xlargePrice: moneyInput(s.xlarge_price_cents),
              ...breedDefaults,
            }}
          />
        </section>
      </div>
    </AppShell>
  );
}
