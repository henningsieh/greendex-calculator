import type { Metadata } from "next";
import { Suspense } from "react";

import { PrefetchedSectionSkeleton } from "@/components/prefetched-page-skeleton";
import { ClaimReview } from "@/features/projects/components/claim-review";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Claim review" };

async function ClaimReviewSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getQueryClient();
  const options = {
    input: { partnershipId: id },
    meta: { costTrackerORPC: true },
  } as const;
  await Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      client.query(orpcQuery.claims.getReviewDetails.queryOptions(options)),
      client.query(orpcQuery.claims.reviewerAccess.queryOptions(options)),
    ].map((promise) => promise.catch(swallowPrefetchError)),
  );
  return (
    <HydrateClient client={client}>
      <ProjectDataErrorBoundary resource="Claim review">
        <ClaimReview partnershipId={id} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

export default async function ClaimReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-semibold">Claim review</h1>
      <Suspense
        fallback={<PrefetchedSectionSkeleton label="Loading Claim review" />}
      >
        <ClaimReviewSection params={params} />
      </Suspense>
    </div>
  );
}
