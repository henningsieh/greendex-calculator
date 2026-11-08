import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProjectWorkspace } from "@/features/projects/components/project-workspace";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export async function ProjectWorkspaceSection({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.projects.get.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="this Project">
        <ProjectWorkspace projectId={id} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
