import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { canViewPartnerNetwork } from "@/features/organizations/access";
import { ProjectPartnershipsSkeleton } from "@/features/projects/components/project-loading-states";
import { ProjectPartnershipSection } from "@/features/projects/components/project-partnership-section";
import { SetupLinkCreator } from "@/features/projects/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  if (!(await hasOrganizationMembership())) return null;

  // Same gate as projectPartnerships.list: without it the section below
  // would only render a denial. Assignment holders see their own rows.
  if (!(await canViewPartnerNetwork())) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p
          className="mt-4 text-lg/8 text-muted-foreground"
          data-testid="hosting-staff-note"
        >
          Partner Organization management is available to Hosting Organization
          staff. Coordinators work from their assigned Projects.
        </p>
      </div>
    );
  }

  const canAssign = await hasCostTrackerPermissions(await headers(), {
    projectPartnership: ["create"],
  });
  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p className="mt-4 text-lg/8 text-muted-foreground">
          Create setup links for hosted Projects, or assign existing Partner
          Organizations if your role permits.
        </p>
      </header>

      {canAssign && (
        <section className="mt-10">
          <SetupLinkCreator />
        </section>
      )}

      <Suspense fallback={<ProjectPartnershipsSkeleton />}>
        <ProjectPartnershipSection canAssign={canAssign} />
      </Suspense>
    </div>
  );
}
