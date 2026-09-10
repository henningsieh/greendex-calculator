import type { Metadata } from "next";

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

type ProjectPageProps = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: ProjectPageProps) {
  if (!(await hasOrganizationMembership())) return null;

  const { id } = await params;
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
        <ProjectWorkspace projectId={id} />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
