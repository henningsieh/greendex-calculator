import type { Metadata } from "next";

import { PartnerOrganizationsList } from "@/features/projects/components/partner-organizations-list";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
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
    .query(orpcQuery.partnerOrganizations.list.queryOptions())
    .catch(swallowPrefetchError);

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Project network</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Partner Organizations
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Organizations assigned to your active Projects through Project
          Partnerships.
        </p>
      </header>

      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Partner Organizations">
          <PartnerOrganizationsList />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
