import type { Metadata } from "next";
import { headers } from "next/headers";

import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectPartnershipManager } from "@/features/projects/components/project-partnership-manager";
import { SetupLinkCreator } from "@/features/projects/components/setup-link";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Partner Organizations" };

export default async function PartnerOrganizationsPage() {
  if (!(await hasOrganizationMembership())) return null;

  const canAssign = await hasCostTrackerPermissions(await headers(), {
    projectPartnership: ["create"],
  });
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.projectPartnerships.list.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

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

      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Project Partnerships">
          <ProjectPartnershipManager canAssign={canAssign} />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
