import {
  createLoader,
  parseAsIsoDate,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

export const PROJECT_COLLECTION_SCOPES = ["hosted", "partner"] as const;
export const PROJECT_WINDOW_FILTERS = ["all", "open", "closed"] as const;
export const PROJECT_SORT_MODES = [
  "operational",
  "start-asc",
  "start-desc",
  "end-asc",
  "end-desc",
] as const;
export const PROJECT_PAGE_SIZES = [25, 50, 100] as const;

const MAX_PARTNER_FILTERS = 20;
const MINIMUM_SEARCH_LENGTH = 3;

export const projectCollectionParsers = {
  scope: parseAsStringLiteral(PROJECT_COLLECTION_SCOPES),
  search: parseAsString.withDefault(""),
  window: parseAsStringLiteral(PROJECT_WINDOW_FILTERS).withDefault("all"),
  dateFrom: parseAsIsoDate,
  dateTo: parseAsIsoDate,
  partnerOrganizationIds: parseAsNativeArrayOf(parseAsString),
  sort: parseAsStringLiteral(PROJECT_SORT_MODES).withDefault("operational"),
  cursor: parseAsString.withDefault(""),
  pageSize: parseAsNumberLiteral(PROJECT_PAGE_SIZES).withDefault(25),
};

export const loadProjectCollectionSearchParams = createLoader(
  projectCollectionParsers,
);

export type ProjectCollectionUrlState = inferParserType<
  typeof projectCollectionParsers
>;

export type ProjectCollectionScope = (typeof PROJECT_COLLECTION_SCOPES)[number];

export type ProjectScopeAvailability = Record<ProjectCollectionScope, boolean>;

export type ProjectCollectionState = {
  scope: ProjectCollectionScope | null;
  search?: string;
  window: (typeof PROJECT_WINDOW_FILTERS)[number];
  dateFrom?: Date;
  dateTo?: Date;
  partnerOrganizationIds: string[];
  sort: (typeof PROJECT_SORT_MODES)[number];
  cursor?: string;
  pageSize: (typeof PROJECT_PAGE_SIZES)[number];
};

export type ResolvedProjectCollectionState = {
  scope: ProjectCollectionScope;
  state: ProjectCollectionState;
  didPartnerToHostedFallback: boolean;
};

export function normalizeProjectCollectionState(
  state: ProjectCollectionUrlState,
): ProjectCollectionState {
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
 * Selects a queryable Project scope before any overview request. A cursor is
 * only valid for the scope that created it, so changing scope always clears it.
 */
export function resolveProjectCollectionState(
  state: ProjectCollectionState,
  availableScopes: ProjectScopeAvailability,
): ResolvedProjectCollectionState {
  const scope =
    state.scope && availableScopes[state.scope]
      ? state.scope
      : availableScopes.hosted
        ? "hosted"
        : "partner";
  const didFallback = state.scope !== null && state.scope !== scope;

  return {
    scope,
    state: {
      ...state,
      scope,
      cursor: didFallback ? undefined : state.cursor,
    },
    didPartnerToHostedFallback:
      state.scope === "partner" && scope === "hosted" && !availableScopes.partner,
  };
}
