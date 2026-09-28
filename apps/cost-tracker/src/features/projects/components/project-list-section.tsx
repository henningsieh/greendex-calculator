import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectList } from "@/features/projects/components/project-list";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectListQueryOptions,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/project-list-query-options";
import { orpcQuery } from "@/lib/orpc/orpc";
import {
  getQueryClient,
  HydrateClient,
  swallowPrefetchError,
} from "@/lib/tanstack-react-query/hydration";

type ProjectListSectionProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Suspends below the Projects page shell while the scope and selected list
 * prefetch resolve. The header and list skeleton can stream first; navigating
 * away can still cancel the underlying RSC response.
 */
export async function ProjectListSection({
  searchParams,
}: ProjectListSectionProps) {
  const queryClient = getQueryClient();
  const [urlState, availableScopes] = await Promise.all([
    loadProjectListSearchParams(searchParams),
    queryClient
      .query(getProjectAvailableScopesQueryOptions())
      .catch(swallowPrefetchError),
  ]);

  if (availableScopes) {
    const resolution = resolveProjectListState(
      normalizeProjectListState(urlState),
      availableScopes,
    );
    if (resolution.scope) {
      await queryClient
        .query(getProjectListQueryOptions(resolution.scope, resolution.state))
        .catch(swallowPrefetchError);
    } else if (availableScopes.canCreate) {
      await queryClient
        .query(
          orpcQuery.projects.searchHosted.queryOptions({
            input: { search: "" },
            meta: { costTrackerORPC: true },
          }),
        )
        .catch(swallowPrefetchError);
    }
  }

  return (
    <HydrateClient client={queryClient}>
      <ProjectDataErrorBoundary resource="Projects">
        <ProjectList />
      </ProjectDataErrorBoundary>
    </HydrateClient>
  );
}
