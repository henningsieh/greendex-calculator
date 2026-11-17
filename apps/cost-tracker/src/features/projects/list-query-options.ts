import {
  createLoader,
  parseAsIsoDate,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import type {
  HostedProjectList,
  PartnerProjectList,
} from "@/features/projects/types";
import {
  PROJECT_ARCHIVE_FILTERS,
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_SETTLEMENT_FILTERS,
  PROJECT_SORT_MODES,
} from "@/features/projects/validation-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";

export {
  PROJECT_ARCHIVE_FILTERS,
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_SETTLEMENT_FILTERS,
  PROJECT_SORT_MODES,
};

const MAX_PARTNER_FILTERS = 20;
const MINIMUM_SEARCH_LENGTH = 3;

export const projectListParsers = {
  scope: parseAsStringLiteral(PROJECT_LIST_SCOPES),
  search: parseAsString.withDefault(""),
  dateFrom: parseAsIsoDate,
  dateTo: parseAsIsoDate,
  archive: parseAsStringLiteral(PROJECT_ARCHIVE_FILTERS).withDefault("active"),
  settlement: parseAsStringLiteral(PROJECT_SETTLEMENT_FILTERS).withDefault("all"),
  partnerOrganizationIds: parseAsNativeArrayOf(parseAsString),
  sort: parseAsStringLiteral(PROJECT_SORT_MODES).withDefault("start-asc"),
  cursor: parseAsString.withDefault(""),
  pageSize: parseAsNumberLiteral(PROJECT_PAGE_SIZES).withDefault(25),
};

export const loadProjectListSearchParams = createLoader(projectListParsers);

export type ProjectListUrlState = inferParserType<typeof projectListParsers>;

export type ProjectListScope = (typeof PROJECT_LIST_SCOPES)[number];

export type HostedProjectListQueryOptions = ReturnType<
  typeof orpcQuery.projects.listHosted.queryOptions<HostedProjectList>
>;
export type PartnerProjectListQueryOptions = ReturnType<
  typeof orpcQuery.projects.listPartner.queryOptions<PartnerProjectList>
>;

export type ProjectListScopeAvailability = Record<ProjectListScope, boolean>;

export type ProjectListState = {
  scope: ProjectListScope | null;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  archive: (typeof PROJECT_ARCHIVE_FILTERS)[number];
  settlement: (typeof PROJECT_SETTLEMENT_FILTERS)[number];
  partnerOrganizationIds: string[];
  sort: (typeof PROJECT_SORT_MODES)[number];
  cursor?: string;
  pageSize: (typeof PROJECT_PAGE_SIZES)[number];
};

export type ResolvedProjectListState = {
  scope: ProjectListScope | null;
  state: ProjectListState;
  didPartnerToHostedFallback: boolean;
};

export function normalizeProjectListState(
  state: ProjectListUrlState,
): ProjectListState {
  const normalizedSearch = state.search.trim().toLocaleLowerCase("en");
  const hasValidDateRange =
    !(state.dateFrom && state.dateTo) ||
    state.dateFrom.getTime() <= state.dateTo.getTime();

  return {
    scope: state.scope,
    search:
      normalizedSearch.length >= MINIMUM_SEARCH_LENGTH
        ? normalizedSearch
        : undefined,
    dateFrom: hasValidDateRange && state.dateFrom ? state.dateFrom : undefined,
    dateTo: hasValidDateRange && state.dateTo ? state.dateTo : undefined,
    archive: state.archive,
    settlement: state.settlement,
    partnerOrganizationIds: [...new Set(state.partnerOrganizationIds)]
      .filter(Boolean)
      .sort()
      .slice(0, MAX_PARTNER_FILTERS),
    sort: state.sort,
    cursor: state.cursor || undefined,
    pageSize: state.pageSize,
  };
}

/**
 * Selects a queryable Project scope before any list request. A cursor is
 * only valid for the scope that created it, so changing scope always clears it.
 */
export function resolveProjectListState(
  state: ProjectListState,
  availableScopes: ProjectListScopeAvailability,
): ResolvedProjectListState {
  const scope =
    state.scope && availableScopes[state.scope]
      ? state.scope
      : availableScopes.hosted
        ? "hosted"
        : availableScopes.partner
          ? "partner"
          : null;
  const didFallback =
    scope !== null && state.scope !== null && state.scope !== scope;

  return {
    scope,
    state: {
      ...state,
      scope,
      cursor: scope === null || didFallback ? undefined : state.cursor,
    },
    didPartnerToHostedFallback:
      state.scope === "partner" && scope === "hosted" && !availableScopes.partner,
  };
}

export function getProjectAvailableScopesQueryOptions() {
  const options = orpcQuery.projects.scopes.queryOptions();

  return { ...options, meta: { costTrackerORPC: true } };
}

/**
 * The complete procedure input for one resolved list state. Shared by the
 * browser query options and the request-local server prefetch so both sides
 * cannot drift into different query keys or filters.
 */
type ProjectListQueryInputBase = {
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  archive: (typeof PROJECT_ARCHIVE_FILTERS)[number];
  settlement: (typeof PROJECT_SETTLEMENT_FILTERS)[number];
  sort: (typeof PROJECT_SORT_MODES)[number];
  cursor?: string;
  pageSize: (typeof PROJECT_PAGE_SIZES)[number];
};

export type HostedProjectListQueryInput = ProjectListQueryInputBase & {
  partnerOrganizationIds: string[];
};
export type PartnerProjectListQueryInput = ProjectListQueryInputBase;

export function getProjectListQueryInput(
  scope: "hosted",
  state: ProjectListState,
): HostedProjectListQueryInput;
export function getProjectListQueryInput(
  scope: "partner",
  state: ProjectListState,
): PartnerProjectListQueryInput;
export function getProjectListQueryInput(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryInput | PartnerProjectListQueryInput;
export function getProjectListQueryInput(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryInput | PartnerProjectListQueryInput {
  const commonInput = {
    search: state.search,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    archive: state.archive,
    settlement: state.settlement,
    sort: state.sort,
    cursor: state.cursor,
    pageSize: state.pageSize,
  };

  return scope === "hosted"
    ? { ...commonInput, partnerOrganizationIds: state.partnerOrganizationIds }
    : commonInput;
}

/**
 * Bridges two intentionally different safe output projections into one
 * discriminated client view while preserving the generated oRPC query key and
 * query function for the selected scope.
 * Keep the scope-specific data/error tags: one widened suspense-options type
 * cannot honestly describe both query functions' key parameters.
 */
export function getProjectListQueryOptions(
  scope: "hosted",
  state: ProjectListState,
): HostedProjectListQueryOptions;
export function getProjectListQueryOptions(
  scope: "partner",
  state: ProjectListState,
): PartnerProjectListQueryOptions;
export function getProjectListQueryOptions(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryOptions | PartnerProjectListQueryOptions;
export function getProjectListQueryOptions(
  scope: ProjectListScope,
  state: ProjectListState,
): HostedProjectListQueryOptions | PartnerProjectListQueryOptions {
  const input = getProjectListQueryInput(scope, state);
  const options =
    scope === "hosted"
      ? orpcQuery.projects.listHosted.queryOptions({
          input,
          meta: { costTrackerORPC: true },
        })
      : orpcQuery.projects.listPartner.queryOptions({
          input,
          meta: { costTrackerORPC: true },
        });

  return options;
}
