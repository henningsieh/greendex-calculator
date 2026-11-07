import { getTranslations } from "@greendex/i18n/server";
import { ORPCError } from "@orpc/client";
import { connection } from "next/server";
import { Suspense } from "react";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ClaimWorkspaceSkeleton } from "@/features/claims/components/claim-loading-states";
import { ClaimWorkspace } from "@/features/claims/components/claim-workspace";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

async function ClaimWorkspaceSection({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const client = getQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  await Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      client.query(orpcQuery.claims.previewSubmission.queryOptions(options)),
      client.query(orpcQuery.claims.listPayoutAccounts.queryOptions(options)),
      client.query(
        orpcQuery.participations.listPartnership.queryOptions(options),
      ),
      client.query(orpcQuery.journeys.list.queryOptions(options)),
      client.query(orpcQuery.costs.list.queryOptions(options)),
      client.query(orpcQuery.documents.list.queryOptions(options)),
    ].map((promise) => promise.catch(swallowPrefetchError)),
  );
  return (
    <HydrateClient client={client}>
      <ProjectDataErrorBoundary resource="Claim workspace">
        <ClaimWorkspace partnershipId={partnershipId} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}

async function ClaimProjectContext({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  const { partnershipId } = await params;
  const data = await getQueryClient()
    .query(
      orpcQuery.participations.listPartnership.queryOptions({
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
  return data?.projectName ?? null;
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  await connection();
  const t = await getTranslations("claims.page");

  return (
    <div className="space-y-8">
      <ProtectedPageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        breadcrumbs={[
          { label: t("projects"), href: "/projects" },
          {
            label: (
              <Suspense fallback={null}>
                <ClaimProjectContext params={params} />
              </Suspense>
            ),
          },
        ]}
      />
      <Suspense fallback={<ClaimWorkspaceSkeleton />}>
        <ClaimWorkspaceSection params={params} />
      </Suspense>
    </div>
  );
}
