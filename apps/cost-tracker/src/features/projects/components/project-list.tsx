"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { Suspense, useEffect, useRef, useSyncExternalStore } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { ProjectListQueryState } from "@/features/projects/components/project-list-filtering";
import { ProjectListFilters } from "@/features/projects/components/project-list-filters";
import {
  ProjectListMetrics,
  ResolvedProjectListResults,
} from "@/features/projects/components/project-list-results";
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
      className="mt-6 flex min-w-0 flex-col gap-4"
      data-hydrated={isHydrated ? "true" : undefined}
      data-testid="project-list"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ProjectScopeTabs
          scope={scope}
          availableScopes={availableScopes}
          updateListState={updateListState}
        />
        <Suspense fallback={<Skeleton className="h-5 w-56" />}>
          <ProjectListMetrics scope={scope} state={state} />
        </Suspense>
      </div>
      <ProjectListFilters
        state={state}
        urlState={urlState}
        setUrlState={setUrlState}
      />
      <Suspense fallback={<ProjectListSkeleton />}>
        <ResolvedProjectListResults
          key={preference.accountKey}
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
