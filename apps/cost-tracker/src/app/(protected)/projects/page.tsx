import type { Metadata } from "next";

import {
  loadProjectCollectionSearchParams,
  normalizeProjectCollectionState,
  resolveProjectCollectionState,
} from "@/features/projects/collection-state";
import { ProjectCollection } from "@/features/projects/components/project-collection";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectOverviewQueryOptions,
} from "@/features/projects/project-overview-query-options";
import { hasOrganizationMembership } from "@/lib/session";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

export const metadata: Metadata = { title: "Projects" };

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage(
  { searchParams }: ProjectsPageProps = {
    searchParams: Promise.resolve({}),
  },
) {
  if (!(await hasOrganizationMembership())) return null;

  const queryClient = getQueryClient();
  const [urlState, availableScopes] = await Promise.all([
    loadProjectCollectionSearchParams(searchParams),
    queryClient
      .query(getProjectAvailableScopesQueryOptions())
      .catch(swallowPrefetchError),
  ]);

  if (availableScopes) {
    const resolution = resolveProjectCollectionState(
      normalizeProjectCollectionState(urlState),
      availableScopes,
    );
    if (resolution.scope) {
      await queryClient
        .query(getProjectOverviewQueryOptions(resolution.scope, resolution.state))
        .catch(swallowPrefetchError);
    }
  }

  return (
    <div>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Project workspace</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
          Projects
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          Review Projects hosted by or assigned to your active Organization.
        </p>
      </header>

      <HydrateClient client={queryClient}>
        <ProjectDataErrorBoundary resource="Projects">
          <ProjectCollection />
        </ProjectDataErrorBoundary>
      </HydrateClient>
    </div>
  );
}
