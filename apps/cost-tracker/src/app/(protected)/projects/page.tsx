import type { Metadata } from "next";

import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectsList } from "@/features/projects/components/projects-list";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const queryClient = getQueryClient();
  await queryClient
    .query(orpcQuery.projects.list.queryOptions())
    .catch(swallowPrefetchError);

  return (
    <div>
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          The active Projects whose travel costs belong to your selected
          Organization.
        </p>
      </header>

      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Projects">
          <ProjectsList />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
