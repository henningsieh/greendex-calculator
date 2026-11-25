"use client";

import { useTranslations } from "@greendex/i18n/client";

import { CardLoading, LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectMetricsLoading } from "@/features/projects/components/project-metrics-loading";

export function ProjectWorkspaceLoading() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("workspace")}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" data-testid="loading-skeleton" />
          <Skeleton
            className="h-9 w-96 max-w-full"
            data-testid="loading-skeleton"
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Skeleton className="h-9 w-40" data-testid="loading-skeleton" />
          <Skeleton className="h-9 w-24" data-testid="loading-skeleton" />
        </div>
        <ProjectMetricsLoading />
        <CardLoading rows={1} />
      </div>
    </LoadingRegion>
  );
}
