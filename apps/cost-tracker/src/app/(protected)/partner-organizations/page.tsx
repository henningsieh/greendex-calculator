import type { Metadata } from "next";

import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectPartnershipManager } from "@/features/projects/components/project-partnership-manager";
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

  const queryClient = getQueryClient();
  await queryClient
    .query(orpcQuery.projectPartnerships.list.queryOptions())
    .catch(swallowPrefetchError);

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Assign existing Organizations to Projects hosted by your active
          Organization and manage those Project Partnerships.
        </p>
      </header>

      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Project Partnerships">
          <ProjectPartnershipManager />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
