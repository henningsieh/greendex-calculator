import { getTranslations } from "@greendex/i18n/server";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import {
  RouteTransition,
  SuspenseFallback,
  SuspenseReveal,
} from "@/components/view-transition-boundaries";
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
  await connection();
  if (!(await hasOrganizationMembership())) return null;

  const t = await getTranslations("claims.queue");

  return (
    <RouteTransition>
      <div className="min-w-0">
        <ProtectedPageHeader
          description={t("description")}
          eyebrow={t("eyebrow")}
          title={t("title")}
        />
        <Suspense
          fallback={
            <SuspenseFallback>
              <ClaimReviewQueueLoading />
            </SuspenseFallback>
          }
        >
          <SuspenseReveal>
            <ClaimReviewQueueSection searchParams={searchParams} />
          </SuspenseReveal>
        </Suspense>
      </div>
    </RouteTransition>
  );
}
