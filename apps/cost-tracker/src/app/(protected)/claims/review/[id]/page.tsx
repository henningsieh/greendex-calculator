import { getTranslations } from "@greendex/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ClaimReviewSkeleton } from "@/features/claims/components/claim-loading-states";
import { ClaimReview } from "@/features/claims/components/claim-review";
import { orpcQuery } from "@/lib/orpc/orpc";
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
  await connection();
  const t = await getTranslations("claims.review");

  return (
    <div className="space-y-6">
      <ProtectedPageHeader eyebrow={t("eyebrow")} title={t("sectionLabel")} />
      <Suspense fallback={<ClaimReviewSkeleton />}>
        <ClaimReviewSection params={params} />
      </Suspense>
    </div>
  );
}
