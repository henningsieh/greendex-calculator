import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ClaimReview } from "@/features/claims/components/claim-review";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

/** "Project name · Partner Organization" for the review header (#390). */
export async function ReviewContext({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const t = await getTranslations("claims.review");
  const details = await getQueryClient()
    .query(
      orpcQuery.claims.getReviewDetails.queryOptions({
        input: { partnershipId },
        meta: { costTrackerORPC: true },
      }),
    )
    // Header context is decorative chrome: it must never take the page down, so
    // every failure degrades to the fallback copy. A refusal is the expected
    // answer for a viewer without access; anything else is a real defect and is
    // logged so it stays observable. The section keeps its own retryable
    // boundary, which this header sits outside of.
    .catch((error: unknown) => {
      if (!isPresentationRefusal(error))
        console.error("Claim review header context failed.");
      return null;
    });
  if (!details)
    return (
      <span data-claim-review-context="unavailable">
        {t("contextUnavailable")}
      </span>
    );
  return (
    <span data-claim-review-context="resolved">
      {`${details.projectName} · ${details.organizationName}`}
    </span>
  );
}

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
  const scope = await client
    .query(orpcQuery.projectPartnerships.getScope.queryOptions(options))
    .catch(swallowPrefetchError);
  await Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      client.query(orpcQuery.claims.getReviewDetails.queryOptions(options)),
      client.query(orpcQuery.claims.reviewerAccess.queryOptions(options)),
      scope?.projectId
        ? client.query(
            orpcQuery.projects.get.queryOptions({
              input: { projectId: scope.projectId },
              meta: { costTrackerORPC: true },
            }),
          )
        : Promise.resolve(),
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

export default async function ClaimReviewPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  await connection();
  if (!(await hasOrganizationMembership())) return null;

  const t = await getTranslations("claims.review");

  return (
    <RouteTransition>
      <div className="space-y-6">
        <ProtectedPageHeader
          description={await ReviewContext({ params })}
          eyebrow={t("eyebrow")}
          title={t("title")}
        />
        <ClaimReviewSection params={params} />
      </div>
    </RouteTransition>
  );
}
