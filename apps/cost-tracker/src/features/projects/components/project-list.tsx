"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type UseQueryStatesReturn, useQueryStates } from "nuqs";
import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";

import { CardSkeleton } from "@/components/loading-skeletons";
import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { AssignedProjectList } from "@/features/projects/components/assigned-project-list";
import { ProjectListFilters } from "@/features/projects/components/project-list-filters";
import { ProjectListMetrics } from "@/features/projects/components/project-list-results";
import { ResolvedProjectListResults } from "@/features/projects/components/project-list-results";
import { ProjectListSkeleton } from "@/features/projects/components/project-loading-states";
import { ProjectScopeTabs } from "@/features/projects/components/project-scope-tabs";
import { getProjectAvailableScopesQueryOptions } from "@/features/projects/list-query-options";
import {
  normalizeProjectListState,
  projectListParsers,
  resolveProjectListState,
  type ProjectListScopeAvailability,
  type ProjectListState,
} from "@/features/projects/list-query-options";

export function ProjectList() {
  const t = useTranslations("projects.list");
  const { data: availableScopes } = useSuspenseQuery(
    getProjectAvailableScopesQueryOptions(),
  );

  if (!availableScopes.hosted && !availableScopes.partner) {
    if (availableScopes.canCreate) {
      return (
        <>
          <ProjectDataErrorBoundary resource="Assigned Projects">
            <AssignedProjectList />
          </ProjectDataErrorBoundary>
        </>
      );
    }
    return (
      <Empty
        data-testid="projects-unavailable"
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
        <AvailableProjectList availableScopes={availableScopes} />
      </ProjectDataErrorBoundary>
    </>
  );
}

type ProjectListQueryState = UseQueryStatesReturn<typeof projectListParsers>;

function AvailableProjectList({
  availableScopes,
}: {
  availableScopes: ProjectListScopeAvailability;
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
  didPartnerToHostedFallback,
  requestedState,
  scope,
  setUrlState,
  state,
  urlState,
}: {
  availableScopes: ProjectListScopeAvailability;
  didPartnerToHostedFallback: boolean;
  requestedState: ProjectListState;
  scope: "hosted" | "partner";
  setUrlState: ProjectListQueryState[1];
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
}) {
  const t = useTranslations("projects.list");
  const fallbackNotices = useRef(new Set<string>());
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

  const updateListState = (patch: Parameters<typeof setUrlState>[0]) =>
    void setUrlState({ ...patch, cursor: null });

  return (
    <section
      aria-label={t("label")}
      className="mt-10 space-y-8"
      data-hydrated={isHydrated ? "true" : undefined}
      data-testid="project-list"
    >
      <ProjectScopeTabs
        scope={scope}
        availableScopes={availableScopes}
        updateListState={updateListState}
      />
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <CardSkeleton rows={1} />
            <CardSkeleton rows={1} />
            {scope === "hosted" && <CardSkeleton rows={1} />}
          </div>
        }
      >
        <ProjectListMetrics scope={scope} state={state} />
      </Suspense>
      <ProjectListFilters
        state={state}
        urlState={urlState}
        setUrlState={setUrlState}
      />
      <Suspense fallback={<ProjectListSkeleton />}>
        <ResolvedProjectListResults
          scope={scope}
          state={state}
          urlState={urlState}
          setUrlState={setUrlState}
        />
      </Suspense>
    </section>
  );
}
