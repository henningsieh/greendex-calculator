import type { Metadata } from "next";

import { getProjectCollectionReturnDestination } from "@/features/projects/collection-state";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectWorkspace } from "@/features/projects/components/project-workspace";
import { orpcQuery } from "@/lib/orpc/orpc";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Project workspace" };

type ProjectPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  if (!(await hasOrganizationMembership())) return null;

  const [{ id }, rawSearchParams] = await Promise.all([
    params,
    searchParams ??
      Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);
  const returnTo = getProjectCollectionReturnDestination(
    rawSearchParams.returnTo,
  );
  const queryClient = getQueryClient();
  await queryClient
    .query(
      orpcQuery.projects.detail.queryOptions({
        input: { projectId: id },
        meta: { costTrackerORPC: true },
      }),
    )
    .catch(swallowPrefetchError);

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="this Project">
        <ProjectWorkspace projectId={id} returnTo={returnTo} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
