import {
  createLoader,
  parseAsIsoDate,
  parseAsJson,
  parseAsNativeArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { isObsoleteProjectCursor } from "@/features/projects/list-cursor-version";
import type {
  HostedProjectList,
  PartnerProjectList,
} from "@/features/projects/types";
import {
  canonicalProjectStatuses,
  normalizeProjectStatuses,
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_STATUSES,
  DEFAULT_PROJECT_SORT,
  ProjectSortOrderSchema,
  type ProjectStatus,
} from "@/features/projects/validation-schemas";
import { orpcQuery } from "@/lib/orpc/orpc";

export {
  PROJECT_LIST_SCOPES,
  PROJECT_PAGE_SIZES,
  PROJECT_STATUSES,
  DEFAULT_PROJECT_SORT,
};

/** URL default only; the status contract tuple and its normalizer live with the validation schemas. */
export const DEFAULT_PROJECT_STATUS_SELECTION: readonly ProjectStatus[] = [
  "open",
  "ready",
];

const MAX_PARTNER_FILTERS = 20;

export const projectListParsers = {
  scope: parseAsStringLiteral(PROJECT_LIST_SCOPES),
  search: parseAsString.withDefault(""),
  dateFrom: parseAsIsoDate,
  dateTo: parseAsIsoDate,
  // An absent status is the default working view; an explicit empty value
  // (`?status=`) means no status constraint.
  status: parseAsNativeArrayOf(
    parseAsStringLiteral(PROJECT_STATUSES),
  ).withDefault([...DEFAULT_PROJECT_STATUS_SELECTION]),
  partnerOrganizationIds: parseAsNativeArrayOf(parseAsString),
  sort: parseAsJson(ProjectSortOrderSchema).withDefault(DEFAULT_PROJECT_SORT),
  cursor: parseAsString.withDefault(""),
  pageSize: parseAsNumberLiteral(PROJECT_PAGE_SIZES).withDefault(25),
};

export const loadProjectListSearchParams = createLoader(projectListParsers);

export type ProjectListUrlState = inferParserType<typeof projectListParsers>;

export type ProjectListScope = (typeof PROJECT_LIST_SCOPES)[number];

type HostedProjectListQueryOptions = ReturnType<
  typeof orpcQuery.projects.listHosted.queryOptions<HostedProjectList>
>;
type PartnerProjectListQueryOptions = ReturnType<
  typeof orpcQuery.projects.listPartner.queryOptions<PartnerProjectList>
>;

export type ProjectListScopeAvailability = Record<ProjectListScope, boolean>;

export type ProjectListState = {
  scope: ProjectListScope | null;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status: ProjectStatus[];
  partnerOrganizationIds: string[];
  sort: ProjectListUrlState["sort"];
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
    // Any non-empty term filters; whitespace-only resets the constraint.
    search: normalizedSearch || undefined,
    dateFrom: hasValidDateRange && state.dateFrom ? state.dateFrom : undefined,
    dateTo: hasValidDateRange && state.dateTo ? state.dateTo : undefined,
    status: canonicalProjectStatuses(state.status),
    partnerOrganizationIds: [...new Set(state.partnerOrganizationIds)]
      .filter(Boolean)
      .sort()
      .slice(0, MAX_PARTNER_FILTERS),
    sort: state.sort,
    // A cursor from an older format version cannot be honored. Dropping it here
    // keeps the server prefetch and the client on page 1 before any request.
    // Opaque cursors stay untouched: only the procedure decides on those.
    cursor:
      state.cursor && !isObsoleteProjectCursor(state.cursor)
        ? state.cursor
        : undefined,
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

export function isDefaultProjectStatusSelection(
  statuses: readonly ProjectStatus[],
): boolean {
  const normalized = normalizeProjectStatuses(statuses);
  return (
    normalized.length === DEFAULT_PROJECT_STATUS_SELECTION.length &&
    normalized.every(
      (status, index) => status === DEFAULT_PROJECT_STATUS_SELECTION[index],
    )
  );
}

export function getProjectAvailableScopesQueryOptions() {
  const options = orpcQuery.projects.scopes.queryOptions();

  return { ...options, meta: { costTrackerORPC: true } };
}

export function getProjectPartnerFilterQueryOptions(state: ProjectListState) {
  return getProjectListQueryOptions("hosted", {
    ...state,
    partnerOrganizationIds: [],
    cursor: undefined,
  });
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
  const commonInput = {
    search: state.search,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    status: state.status,
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
