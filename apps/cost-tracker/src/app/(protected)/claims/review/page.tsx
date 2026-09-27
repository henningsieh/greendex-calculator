import type { Metadata } from "next";

import { ClaimReviewQueue } from "@/features/projects/components/claim-review-queue";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Submitted Claims" };

export default async function ClaimReviewQueuePage() {
  if (!(await hasOrganizationMembership())) return null;
  const client = getQueryClient();
  await client
    .query(
      orpcQuery.projectPartnerships.list.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-semibold">
        Hosting Claim review
      </h1>
      <HydrateClient client={client}>
        <ProjectDataErrorBoundary resource="submitted Claims">
          <ClaimReviewQueue />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
