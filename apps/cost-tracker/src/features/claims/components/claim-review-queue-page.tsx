import { getTranslations } from "@greendex/i18n/server";
import { Suspense } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { ClaimReviewQueue } from "@/features/claims/components/claim-review-queue";
import { ClaimReviewQueueLoading } from "@/features/claims/components/claim-review-queue-loading";
import {
  getClaimQueueQueryOptions,
  loadClaimQueueSearchParams,
  normalizeClaimQueueState,
} from "@/features/claims/queue-query-options";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

interface ClaimReviewQueuePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

async function ClaimReviewQueueSection({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const client = getQueryClient();
  const urlState = await loadClaimQueueSearchParams(
    searchParams ?? Promise.resolve({}),
  );
  await client
    .query(getClaimQueueQueryOptions(normalizeClaimQueueState(urlState)))
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={client}>
      <ProjectDataErrorBoundary resource="submitted Claims">
        <ClaimReviewQueue />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

export default async function ClaimReviewQueuePage(
  { searchParams }: ClaimReviewQueuePageProps = {
    searchParams: Promise.resolve({}),
  },
) {
  if (!(await hasOrganizationMembership())) return null;

  const t = await getTranslations("claims.queue");

  return (
    <RouteTransition>
      <div className="min-w-0">
        <ProtectedRouteHeader
          description={t("description")}
          page="claims"
          title={t("title")}
        />
        <Suspense fallback={<ClaimReviewQueueLoading />}>
          <ClaimReviewQueueSection searchParams={searchParams} />
        </Suspense>
      </div>
    </RouteTransition>
  );
}
