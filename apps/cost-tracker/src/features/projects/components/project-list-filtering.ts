import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

import {
  PROJECT_PAGE_SIZES,
  DEFAULT_PROJECT_SORT,
} from "@/features/projects/list-query-options";
import type { ProjectListQueryState } from "@/features/projects/types";
import { ProjectSortOrderSchema } from "@/features/projects/validation-schemas";

export const PROJECT_FILTER_IDS = {
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  name: "name",
  partnerOrganizationIds: "partnerOrganizationIds",
} as const;

export function getProjectColumnFilters({
  dateFrom,
  dateTo,
  partnerOrganizationIds,
  search,
}: {
  dateFrom: Date | null;
  dateTo: Date | null;
  partnerOrganizationIds: string[];
  search: string;
}): ColumnFiltersState {
  return [
    { id: PROJECT_FILTER_IDS.name, value: search },
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
  sort: ProjectListQueryState[0]["sort"],
): SortingState {
  return sort.map(({ field, direction }) => ({
    id: field,
    desc: direction === "desc",
  }));
}

export function getProjectSortMode(sorting: SortingState) {
  const parsed = ProjectSortOrderSchema.safeParse(
    sorting.map(({ id, desc }) => ({
      field: id,
      direction: desc ? "desc" : "asc",
    })),
  );
  return parsed.success ? parsed.data : DEFAULT_PROJECT_SORT;
}

/**
 * Single writer for filter state into the URL (nuqs stays the source of
 * truth). Both the filter bar above the Suspense boundary and the table
 * callbacks below it funnel through here.
 */
export function pushColumnFiltersToUrl(
  nextFilters: ColumnFiltersState,
  urlState: ProjectListQueryState[0],
  setUrlState: ProjectListQueryState[1],
) {
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
  });
}
