import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import type { UseQueryStatesReturn } from "nuqs";

import {
  projectListParsers,
  PROJECT_PAGE_SIZES,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
  type ProjectListState,
} from "@/features/projects/list-query-options";

export const PROJECT_FILTER_IDS = {
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  name: "name",
  partnerOrganizationIds: "partnerOrganizationIds",
  window: "window",
} as const;

export type ProjectListQueryState = UseQueryStatesReturn<
  typeof projectListParsers
>;

export function getProjectColumnFilters({
  dateFrom,
  dateTo,
  partnerOrganizationIds,
  search,
  window,
}: {
  dateFrom: Date | null;
  dateTo: Date | null;
  partnerOrganizationIds: string[];
  search: string;
  window: (typeof PROJECT_WINDOW_FILTERS)[number];
}): ColumnFiltersState {
  return [
    { id: PROJECT_FILTER_IDS.name, value: search },
    { id: PROJECT_FILTER_IDS.window, value: window },
    { id: PROJECT_FILTER_IDS.dateFrom, value: dateFrom },
    { id: PROJECT_FILTER_IDS.dateTo, value: dateTo },
    {
      id: PROJECT_FILTER_IDS.partnerOrganizationIds,
      value: partnerOrganizationIds,
    },
  ];
}

export function getStringFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: string,
) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return typeof value === "string" ? value : fallback;
}

export function isProjectWindowFilter(
  value: string,
): value is (typeof PROJECT_WINDOW_FILTERS)[number] {
  return PROJECT_WINDOW_FILTERS.some((filter) => filter === value);
}

export function isProjectPageSize(
  value: number,
): value is (typeof PROJECT_PAGE_SIZES)[number] {
  return PROJECT_PAGE_SIZES.some((pageSize) => pageSize === value);
}

export function getDateFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: Date | null,
) {
  const filter = filters.find((entry) => entry.id === id);
  if (!filter) return fallback;
  return filter.value instanceof Date ? filter.value : null;
}

export function getStringArrayFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: string[],
) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

export function getSortingState(
  sort: (typeof PROJECT_SORT_MODES)[number],
): SortingState {
  switch (sort) {
    case "start-asc":
      return [{ id: "startDate", desc: false }];
    case "start-desc":
      return [{ id: "startDate", desc: true }];
    case "end-asc":
      return [{ id: "endDate", desc: false }];
    case "end-desc":
      return [{ id: "endDate", desc: true }];
    default:
      return [{ id: "operational", desc: false }];
  }
}

export function getProjectSortMode(sorting: SortingState) {
  const currentSort = sorting[0];
  if (currentSort?.id === "startDate") {
    return currentSort.desc ? "start-desc" : "start-asc";
  }
  if (currentSort?.id === "endDate") {
    return currentSort.desc ? "end-desc" : "end-asc";
  }
  return "operational";
}

/**
 * Single writer for filter state into the URL (nuqs stays the source of
 * truth). Both the filter bar above the Suspense boundary and the table
 * callbacks below it funnel through here.
 */
export function pushColumnFiltersToUrl(
  nextFilters: ColumnFiltersState,
  state: ProjectListState,
  urlState: ProjectListQueryState[0],
  setUrlState: ProjectListQueryState[1],
) {
  const nextWindow = getStringFilterValue(
    nextFilters,
    PROJECT_FILTER_IDS.window,
    state.window,
  );

  void setUrlState({
    cursor: null,
    dateFrom: getDateFilterValue(
      nextFilters,
      PROJECT_FILTER_IDS.dateFrom,
      urlState.dateFrom,
    ),
    dateTo: getDateFilterValue(
      nextFilters,
      PROJECT_FILTER_IDS.dateTo,
      urlState.dateTo,
    ),
    partnerOrganizationIds: getStringArrayFilterValue(
      nextFilters,
      PROJECT_FILTER_IDS.partnerOrganizationIds,
      urlState.partnerOrganizationIds,
    ),
    search: getStringFilterValue(
      nextFilters,
      PROJECT_FILTER_IDS.name,
      urlState.search,
    ),
    window: isProjectWindowFilter(nextWindow) ? nextWindow : state.window,
  });
}
