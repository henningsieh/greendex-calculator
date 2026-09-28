import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectPartnershipManager } from "@/features/projects/components/project-partnership-manager";
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
