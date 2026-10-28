import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ClaimReviewQueueSkeleton } from "@/features/claims/components/claim-loading-states";
import { ClaimReviewQueue } from "@/features/claims/components/claim-review-queue";
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
  const t = await getTranslations("claims.review");

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-4xl font-semibold">{t("hostingTitle")}</h1>
      <Suspense fallback={<ClaimReviewQueueSkeleton />}>
        <ClaimReviewQueueSection />
      </Suspense>
    </div>
  );
}
