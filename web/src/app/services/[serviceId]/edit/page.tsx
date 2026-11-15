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

export default async function EditServicePage({ params }: PageProps<"/services/[serviceId]/edit">) {
  const { serviceId } = await params;
  const workspace = await requireWorkspace();
  if (!canManageServices(workspace.role)) redirect("/services");
  if (!UUID_PATTERN.test(serviceId)) notFound();

  const { active, retired } = await getServices(workspace);
  const s = [...active, ...retired].find((x) => x.id === serviceId);
  if (!s) notFound();

  return (
    <AppShell workspace={workspace} active="services" crumb="Edit service">
      <div className="setup-page">
        <Link href="/services" className="setup-back"><ArrowLeft size={15} /> Back to services</Link>
        <span className="overline setup-overline"><Tag size={14} /> EDIT SERVICE</span>
        <h1>Edit<br /><em>{s.name}.</em></h1>
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
            }}
          />
        </section>
      </div>
    </AppShell>
  );
}
