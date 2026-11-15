import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireWorkspace } from "@/lib/dal";
import { canManageServices } from "@/lib/roles";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Add service | Grooming Desk" };

// Depends on who is logged in, so it renders per request.
export const instant = false;

export default async function NewServicePage() {
  const workspace = await requireWorkspace();
  if (!canManageServices(workspace.role)) redirect("/services");

  return (
    <AppShell workspace={workspace} active="services" crumb="Add service">
      <div className="setup-page">
        <Link href="/services" className="setup-back"><ArrowLeft size={15} /> Back to services</Link>
        <span className="overline setup-overline"><Tag size={14} /> NEW SERVICE</span>
        <h1>Add to<br /><em>the menu.</em></h1>
        <section className="team-card member-edit">
          <ServiceForm defaults={{ pricing: "flat" }} />
        </section>
      </div>
    </AppShell>
  );
}
