import { getTranslations } from "@greendex/i18n/server";

import ProtectedPageHeader from "@/components/protected-page-header";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ClaimWorkspace } from "@/features/claims/components/claim-workspace";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
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
  const people = client.query(
    orpcQuery.participations.listPartnership.queryOptions(options),
  );
  await Promise.all(
    [
      client.query(orpcQuery.claims.getDraft.queryOptions(options)),
      client.query(orpcQuery.claims.getHistory.queryOptions(options)),
      client.query(orpcQuery.claims.previewSubmission.queryOptions(options)),
      client.query(orpcQuery.claims.listPayoutAccounts.queryOptions(options)),
      people,
      client.query(orpcQuery.journeys.list.queryOptions(options)),
      client.query(orpcQuery.costs.list.queryOptions(options)),
      client.query(orpcQuery.documents.list.queryOptions(options)),
      people.then((result) =>
        client.query(
          orpcQuery.projects.get.queryOptions({
            input: { projectId: result.projectId },
            meta: { costTrackerORPC: true },
          }),
        ),
      ),
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

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  const section = ClaimWorkspaceSection({ params });
  const t = await getTranslations("claims.page");

  return (
    <RouteTransition>
      <div className="space-y-8">
        <ProtectedPageHeader eyebrow={t("eyebrow")} title={t("title")} />
        {await section}
      </div>
    </RouteTransition>
  );
}
