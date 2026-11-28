"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { SectionTabsRow, SectionTabsWrapper } from "@/components/section-tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import {
  getProjectColumnFilters,
  PROJECT_FILTER_IDS,
  pushColumnFiltersToUrl,
} from "@/features/projects/components/project-list-filtering";
import { ProjectListFilters } from "@/features/projects/components/project-list-filters";
import {
  ProjectListMetrics,
  ResolvedProjectListResults,
} from "@/features/projects/components/project-list-results";
import { ProjectListResultsLoading } from "@/features/projects/components/project-list-results-loading";
import { ProjectScopeTabs } from "@/features/projects/components/project-scope-tabs";
import { getProjectAvailableScopesQueryOptions } from "@/features/projects/list-query-options";
import {
  normalizeProjectListState,
  projectListParsers,
  resolveProjectListState,
  type ProjectListScopeAvailability,
  type ProjectListState,
} from "@/features/projects/list-query-options";
import type { ProjectListQueryState } from "@/features/projects/types";
import { useDebouncedSearchDraft } from "@/hooks/use-debounced-search-draft";
import type { ProjectVisibility } from "@/lib/ui-preferences/definitions";

interface VisibilityPreference {
  accountKey: string;
  visibility: ProjectVisibility;
}

export function ProjectList({
  hasStaffMembership,
  preference,
}: {
  hasStaffMembership: boolean;
  preference: VisibilityPreference;
}) {
  const t = useTranslations("projects.list");
  const { data: availableScopes } = useSuspenseQuery(
    getProjectAvailableScopesQueryOptions(),
  );

  if (!availableScopes.hosted && !availableScopes.partner) {
    return (
      <Empty
        data-testid={
          hasStaffMembership ? "projects-empty" : "projects-unavailable"
        }
        variant="outlined"
        aria-label={t("label")}
        className="mt-10"
      >
        <EmptyHeader>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <ProjectDataErrorBoundary resource="Projects">
        <AvailableProjectList
          availableScopes={availableScopes}
          preference={preference}
        />
      </ProjectDataErrorBoundary>
    </>
  );
}

function AvailableProjectList({
  availableScopes,
  preference,
}: {
  availableScopes: ProjectListScopeAvailability;
  preference: VisibilityPreference;
}) {
  const [urlState, setUrlState] = useQueryStates(projectListParsers, {
    history: "push",
    shallow: true,
  });
  const requestedState = normalizeProjectListState(urlState);
  const resolution = resolveProjectListState(requestedState, availableScopes);

  if (!resolution.scope) {
    return null;
  }

  return (
    <ResolvedProjectList
      availableScopes={availableScopes}
      preference={preference}
      didPartnerToHostedFallback={resolution.didPartnerToHostedFallback}
      requestedState={requestedState}
      scope={resolution.scope}
      setUrlState={setUrlState}
      state={resolution.state}
      urlState={urlState}
    />
  );
}

function ResolvedProjectList({
  availableScopes,
  preference,
  didPartnerToHostedFallback,
  requestedState,
  scope,
  setUrlState,
  state,
  urlState,
}: {
  availableScopes: ProjectListScopeAvailability;
  preference: VisibilityPreference;
  didPartnerToHostedFallback: boolean;
  requestedState: ProjectListState;
  scope: "hosted" | "partner";
  setUrlState: ProjectListQueryState[1];
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
}) {
  const t = useTranslations("projects.list");
  const fallbackNotices = useRef(new Set<string>());
  const cursorNotices = useRef(new Set<string>());
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!didPartnerToHostedFallback) return;

    const noticeKey = `${requestedState.scope}:${requestedState.cursor ?? ""}`;
    if (fallbackNotices.current.has(noticeKey)) return;

    fallbackNotices.current.add(noticeKey);
    void setUrlState({ cursor: null, scope }, { history: "replace" });
    toast.add({
      description:
        "Partner Projects are unavailable. Hosted Projects are shown instead.",
      title: "Project view updated",
      type: "info",
    });
  }, [
    requestedState.cursor,
    requestedState.scope,
    didPartnerToHostedFallback,
    scope,
    setUrlState,
  ]);

  useEffect(() => {
    // Normalization drops a cursor from another format version before the
    // request, so the list already shows page 1; tidy the URL and say why.
    const droppedCursor = urlState.cursor && !requestedState.cursor;
    if (!droppedCursor || cursorNotices.current.has(urlState.cursor)) return;

    cursorNotices.current.add(urlState.cursor);
    void setUrlState({ cursor: null }, { history: "replace" });
    toast.add({
      description: (
        <span className="flex flex-col gap-1">
          <span>{t("invalidCursor.description")}</span>
          <span className="text-xs">{t("invalidCursor.hint")}</span>
        </span>
      ),
      title: t("invalidCursor.title"),
      type: "error",
    });
  }, [requestedState.cursor, setUrlState, t, urlState.cursor]);

  const updateListState = (patch: Parameters<typeof setUrlState>[0]) =>
    void setUrlState({ ...patch, cursor: null });

  const updateProjectFilter = (
    id: (typeof PROJECT_FILTER_IDS)[keyof typeof PROJECT_FILTER_IDS],
    value: unknown,
  ) =>
    pushColumnFiltersToUrl(
      [
        ...getProjectColumnFilters(urlState).filter((filter) => filter.id !== id),
        { id, value },
      ],
      urlState,
      setUrlState,
    );

  const {
    draft: searchDraft,
    onChange: updateSearchDraft,
    resetDraft,
  } = useDebouncedSearchDraft({
    urlSearch: urlState.search,
    push: (search) => updateProjectFilter(PROJECT_FILTER_IDS.name, search),
  });

  const clearFilters = () => {
    // The URL search may already be empty; cancel the pending draft here so
    // Clear filters cannot be undone by the debounce.
    resetDraft("");
    void setUrlState({
      cursor: null,
      dateFrom: null,
      dateTo: null,
      partnerOrganizationIds: null,
      search: null,
      status: null,
    });
  };

  return (
    <section
      aria-label={t("label")}
      className="flex min-w-0 flex-col gap-4"
      data-hydrated={isHydrated ? "true" : undefined}
      data-testid="project-list"
    >
      <SectionTabsWrapper>
        <SectionTabsRow>
          <ProjectScopeTabs
            scope={scope}
            availableScopes={availableScopes}
            updateListState={updateListState}
          />
          <Suspense
            fallback={
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-36" />
              </div>
            }
          >
            <ProjectListMetrics scope={scope} state={state} />
          </Suspense>
        </SectionTabsRow>
      </SectionTabsWrapper>
      <ProjectListFilters
        onSearchChange={updateSearchDraft}
        searchDraft={searchDraft}
        setUrlState={setUrlState}
        state={state}
        urlState={urlState}
      />
      <Suspense fallback={<ProjectListResultsLoading />}>
        <ResolvedProjectListResults
          key={preference.accountKey}
          onClearFilters={clearFilters}
          preference={preference}
          scope={scope}
          state={state}
          urlState={urlState}
          setUrlState={setUrlState}
        />
      </Suspense>
    </section>
  );
}
