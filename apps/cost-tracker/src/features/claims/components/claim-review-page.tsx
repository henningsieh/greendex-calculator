import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
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

async function ClaimReviewSection({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const client = getQueryClient();
  const options = {
    input: { partnershipId },
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
        <ClaimReview partnershipId={partnershipId} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

async function ReviewContext({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("claims.review");
  const partnership = await getQueryClient()
    .query(
      orpcQuery.claims.getReviewDetails.queryOptions({
        input: { partnershipId },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch((error: unknown) => {
      if (
        !(error instanceof ORPCError) ||
        !["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
      )
        throw error;
      return null;
    });
  return partnership
    ? `${partnership.projectName} · ${partnership.organizationName}`
    : t("contextUnavailable");
}

export default async function ClaimReviewPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  await connection();
  const t = await getTranslations("claims.review");

  return (
    <div className="space-y-6">
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        breadcrumbs={[
          { label: t("queueTitle"), href: "/claims/review" },
          {
            label: (
              <Suspense fallback={t("contextLoading")}>
                <ReviewContext params={params} />
              </Suspense>
            ),
          },
        ]}
      />
      <Suspense fallback={<ClaimReviewSkeleton />}>
        <ClaimReviewSection params={params} />
      </Suspense>
    </div>
  );
}
