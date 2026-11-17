import { headers } from "next/headers";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { ProjectWorkspace } from "@/features/projects/components/project-workspace";
import { hasCostTrackerPermissions } from "@/lib/orpc/middleware";
import { orpcQuery } from "@/lib/orpc/orpc";
import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";
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
  // Presentation-only: the dialogs re-enforce on every call. Fail closed.
  const canManagePartnerships = await hasCostTrackerPermissions(await headers(), {
    projectPartnership: ["create"],
  }).catch((error: unknown) => {
    if (isPresentationRefusal(error)) return false;
    throw error;
  });
  const canReopen = await hasCostTrackerPermissions(await headers(), {
    project: ["reopen"],
  }).catch((error: unknown) => {
    if (isPresentationRefusal(error)) return false;
    throw error;
  });
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
        <ProjectWorkspace
          canManagePartnerships={canManagePartnerships}
          canReopen={canReopen}
          projectId={id}
        />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
