import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import { ProjectPartnershipSection } from "@/features/projects/components/project-partnership-section";
import { SetupLinkCreator } from "@/features/projects/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { hasOrganizationMembership } from "@/lib/session";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  if (!(await hasOrganizationMembership())) return null;

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
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Create setup links for hosted Projects, or assign existing Partner
          Organizations if your role permits.
        </p>
      </header>

      <section className="mt-10">
        <SetupLinkCreator />
      </section>

      <Suspense
        fallback={
          <PrefetchedSectionSkeleton label="Loading Project Partnerships" />
        }
      >
        <ProjectPartnershipSection canAssign={canAssign} />
      </Suspense>
    </div>
  );
}
