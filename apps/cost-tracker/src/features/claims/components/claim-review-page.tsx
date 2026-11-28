import { getTranslations } from "@greendex/i18n/server";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { ClaimReview } from "@/features/claims/components/claim-review";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
import type { Outputs } from "@/lib/orpc/router";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function ReviewContext({
  details,
}: {
  details:
    | Pick<
        Outputs["claims"]["getReviewDetails"],
        "projectName" | "organizationName"
      >
    | undefined;
}) {
  const t = await getTranslations("claims.review");
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

export default async function ClaimReviewPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  const { partnershipId } = await params;
  const client = getQueryClient();
  const options = {
    input: { partnershipId },
    meta: { costTrackerORPC: true },
  } as const;
  const details = client.query(
    orpcQuery.claims.getReviewDetails.queryOptions(options),
  );
  const prefetch = Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      details,
      client.query(orpcQuery.claims.reviewerAccess.queryOptions(options)),
      details.then((result) =>
        client.query(
          orpcQuery.projects.get.queryOptions({
            input: { projectId: result.projectId },
            meta: { costTrackerORPC: true },
          }),
        ),
      ),
    ].map((promise) => promise.catch(swallowPrefetchError)),
  );
  const [review] = await Promise.all([
    details.catch((error: unknown) => {
      if (!isPresentationRefusal(error))
        console.error("Claim review header context failed.");
      return undefined;
    }),
    prefetch,
  ]);

  return (
    <RouteTransition>
      <div className="space-y-6">
        <ProtectedRouteHeader
          page="claimReview"
          context={
            review
              ? { projectId: review.projectId, relationship: "hosted" }
              : undefined
          }
          description={<ReviewContext details={review} />}
        />
        <HydrateClient client={client}>
          <ProjectDataErrorBoundary resource="Claim review">
            <ClaimReview partnershipId={partnershipId} />
          </ProjectDataErrorBoundary>
        </HydrateClient>
      </div>
    </RouteTransition>
  );
}
