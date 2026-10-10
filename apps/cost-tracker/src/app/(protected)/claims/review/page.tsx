import type { Metadata } from "next";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
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

async function ClaimReviewQueueSection() {
  const client = getQueryClient();
  const partnerships = await client
    .query(
      orpcQuery.projectPartnerships.list.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);
  if (partnerships) {
    await Promise.all(
      partnerships.map((item) =>
        client
          .query(
            orpcQuery.claims.getDraft.queryOptions({
              input: { partnershipId: item.id },
              meta: { costTrackerORPC: true },
            }),
          )
          .catch(swallowPrefetchError),
      ),
    );
  }
  return (
    <HydrateClient client={client}>
      <ProjectDataErrorBoundary resource="submitted Claims">
        <ClaimReviewQueue />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

export default async function ClaimReviewQueuePage() {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-semibold">
        Hosting Claim review
      </h1>
      <Suspense
        fallback={<PrefetchedSectionSkeleton label="Loading submitted Claims" />}
      >
        <ClaimReviewQueueSection />
      </Suspense>
    </div>
  );
}
