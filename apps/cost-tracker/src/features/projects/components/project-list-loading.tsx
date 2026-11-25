"use client";

import { useTranslations } from "@greendex/i18n/client";

import { LoadingRegion } from "@/components/loading-skeletons";
import { ProjectListFiltersLoading } from "@/features/projects/components/project-list-filters-loading";
import { ProjectListResultsLoadingContent } from "@/features/projects/components/project-list-results-loading";
import { ProjectScopeTabsLoading } from "@/features/projects/components/project-scope-tabs-loading";

/**
 * Section fallback for the Projects page: the scope-tabs row, the filter card
 * and the results register, with the same `mt-6`/`gap-4` rhythm as the
 * resolved section. The page shell already renders the real header.
 */
export function ProjectListLoadingContent() {
  return (
    <div className="mt-6 flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <ProjectScopeTabsLoading />
      </div>
      <ProjectListFiltersLoading />
      {/* The resolved list wraps its results in this gap-3 column; the
          skeleton must too, or every gap below the filters grows to the
          section's gap-4. */}
      <div className="flex min-w-0 flex-col gap-3">
        <ProjectListResultsLoadingContent />
      </div>
    </div>
  );
}

/** Section fallback for the inner Suspense boundary on the Projects page. */
export function ProjectListLoading() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("list")}>
      <ProjectListLoadingContent />
    </LoadingRegion>
  );
}
