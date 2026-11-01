import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProjectPartnershipManager } from "@/features/partnerships/components/project-partnership-manager";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function ProjectPartnershipSection({
  canAssign,
}: {
  canAssign: boolean;
}) {
  const queryClient = getQueryClient();
  await Promise.all(
    [
      queryClient.query(
        orpcQuery.projectPartnerships.list.queryOptions({
          meta: { costTrackerORPC: true },
        }),
      ),
      queryClient.query(
        orpcQuery.projects.searchHosted.queryOptions({
          input: { search: "" },
          meta: { costTrackerORPC: true },
        }),
      ),
    ].map((promise) => promise.catch(swallowPrefetchError)),
  );

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Project Partnerships">
        <ProjectPartnershipManager canAssign={canAssign} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
