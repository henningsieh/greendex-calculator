import type { UseSuspenseQueryOptions } from "@tanstack/react-query";

import type { ProjectCollectionState } from "@/features/projects/collection-state";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";

export type ProjectOverviewData =
  | Awaited<ReturnType<typeof orpc.projects.hostedOverview>>
  | Awaited<ReturnType<typeof orpc.projects.partnerOverview>>;

export function getProjectAvailableScopesQueryOptions() {
  const options = orpcQuery.projects.availableScopes.queryOptions();

  return { ...options, meta: { costTrackerORPC: true } };
}

/**
 * Bridges two intentionally different safe output projections into one
 * discriminated client view while preserving the generated oRPC query key and
 * query function for the selected scope.
 */
export function getProjectOverviewQueryOptions(
  scope: "hosted" | "partner",
  state: ProjectCollectionState,
): UseSuspenseQueryOptions<ProjectOverviewData> {
  const commonInput = {
    search: state.search,
    window: state.window,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    sort: state.sort,
    cursor: state.cursor,
    pageSize: state.pageSize,
  };
  const options =
    scope === "hosted"
      ? orpcQuery.projects.hostedOverview.queryOptions({
          input: {
            ...commonInput,
            partnerOrganizationIds: state.partnerOrganizationIds,
          },
          meta: { costTrackerORPC: true },
        })
      : orpcQuery.projects.partnerOverview.queryOptions({
          input: commonInput,
          meta: { costTrackerORPC: true },
        });

  return options as unknown as UseSuspenseQueryOptions<ProjectOverviewData>;
}
