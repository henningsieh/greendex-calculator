import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { RouteTransition } from "@/components/view-transition-boundaries";
import { ProtectedRouteHeader } from "@/features/breadcrumbs/components/protected-route-header";
import { partnershipNavigation } from "@/features/breadcrumbs/partnership-navigation";
import { ClaimWorkspace } from "@/features/claims/components/claim-workspace";
import { orpcQuery } from "@/lib/orpc/orpc";
import { getSession, hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ partnershipId: string }>;
}) {
  if (!(await hasOrganizationMembership())) return null;

  const { partnershipId } = await params;
  const client = getQueryClient();
  const input = { partnershipId };
  const options = { input, meta: { costTrackerORPC: true } } as const;
  const people = client.query(
    orpcQuery.participations.listPartnership.queryOptions(options),
  );
  const prefetch = Promise.all(
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
  const [navigationData, session] = await Promise.all([
    people.catch(() => undefined),
    getSession(),
    prefetch,
  ]);
  return (
    <RouteTransition>
      <div className="space-y-8">
        <ProtectedRouteHeader
          page="claim"
          context={
            navigationData
              ? partnershipNavigation(
                  navigationData.projectId,
                  partnershipId,
                  navigationData.entryContext,
                  session?.session.activeOrganizationId,
                )
              : undefined
          }
        />
        <HydrateClient client={client}>
          <ProjectDataErrorBoundary resource="Claim workspace">
            <ClaimWorkspace partnershipId={partnershipId} />
          </ProjectDataErrorBoundary>
        </HydrateClient>
      </div>
    </RouteTransition>
  );
}
