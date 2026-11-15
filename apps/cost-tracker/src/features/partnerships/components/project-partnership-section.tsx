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
  await queryClient
    .query(
      orpcQuery.projectPartnerships.list.queryOptions({
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  // No local boundary: the page wraps everything (header included) in one
  // ProjectDataErrorBoundary, so a denial replaces the whole page exactly
  // like the Project workspace does.
  return (
    <HydrateClient client={queryClient}>
      <ProjectPartnershipManager canAssign={canAssign} />
    </HydrateClient>
  );
}
