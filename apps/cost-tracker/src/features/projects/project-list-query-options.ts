import type { UseSuspenseQueryOptions } from "@tanstack/react-query";
import {
  createLoader,
  parseAsIsoDate,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import type { ProjectListData } from "@/features/projects/types";
import {
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
} from "@/features/projects/validation-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";

export {
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
};

const MAX_PARTNER_FILTERS = 20;
const MINIMUM_SEARCH_LENGTH = 3;
const PROJECT_LIST_PATH = "/projects";
const LOCAL_URL_ORIGIN = "https://cost-tracker.local";

export const projectListParsers = {
  scope: parseAsStringLiteral(PROJECT_LIST_SCOPES),
  search: parseAsString.withDefault(""),
  window: parseAsStringLiteral(PROJECT_WINDOW_FILTERS).withDefault("all"),
  dateFrom: parseAsIsoDate,
  dateTo: parseAsIsoDate,
  partnerOrganizationIds: parseAsNativeArrayOf(parseAsString),
  sort: parseAsStringLiteral(PROJECT_SORT_MODES).withDefault("operational"),
  cursor: parseAsString.withDefault(""),
  pageSize: parseAsNumberLiteral(PROJECT_PAGE_SIZES).withDefault(25),
};

export const loadProjectListSearchParams = createLoader(projectListParsers);

export type ProjectListUrlState = inferParserType<typeof projectListParsers>;

export type ProjectListScope = (typeof PROJECT_LIST_SCOPES)[number];

export type ProjectListScopeAvailability = Record<ProjectListScope, boolean>;

export type ProjectListState = {
  scope: ProjectListScope | null;
  search?: string;
  window: (typeof PROJECT_WINDOW_FILTERS)[number];
  dateFrom?: Date;
  dateTo?: Date;
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

/**
 * Accepts only a local Project list URL. This keeps return context out of
 * workspace authorization and prevents open redirects from crafted links.
 */
export function getProjectListReturnDestination(returnTo: unknown): string {
  if (
    typeof returnTo !== "string" ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return PROJECT_LIST_PATH;
  }

  try {
    const url = new URL(returnTo, LOCAL_URL_ORIGIN);
    return url.origin === LOCAL_URL_ORIGIN && url.pathname === PROJECT_LIST_PATH
      ? returnTo
      : PROJECT_LIST_PATH;
  } catch {
    return PROJECT_LIST_PATH;
  }
}

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
    window: state.window,
    dateFrom: hasValidDateRange && state.dateFrom ? state.dateFrom : undefined,
    dateTo: hasValidDateRange && state.dateTo ? state.dateTo : undefined,
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
 * Bridges two intentionally different safe output projections into one
 * discriminated client view while preserving the generated oRPC query key and
 * query function for the selected scope.
 */
export function getProjectListQueryOptions(
  scope: ProjectListScope,
  state: ProjectListState,
): UseSuspenseQueryOptions<ProjectListData> {
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
      ? orpcQuery.projects.listHosted.queryOptions({
          input: {
            ...commonInput,
            partnerOrganizationIds: state.partnerOrganizationIds,
          },
          meta: { costTrackerORPC: true },
        })
      : orpcQuery.projects.listPartner.queryOptions({
          input: commonInput,
          meta: { costTrackerORPC: true },
        });

  return options;
}
