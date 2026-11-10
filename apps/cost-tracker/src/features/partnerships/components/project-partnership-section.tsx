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
  // Creation lives in the page-header dialogs with search-on-demand pickers,
  // so the list below is the only query any viewer needs prefetched.
  await queryClient
    .query(
      orpcQuery.projectPartnerships.list.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Project Partnerships">
        <ProjectPartnershipManager canAssign={canAssign} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
