"use client";

import { useTranslations } from "@greendex/i18n/client";

import {
  LoadingRegion,
  ProtectedPageHeaderLoading,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectListLoadingContent } from "@/features/projects/components/project-list-loading";

/**
 * Route fallback for `projects/loading.tsx`: the header sketch and the list
 * section exactly as the page shell renders them.
 */
export function ProjectsPageLoading() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("projects")}>
      <ProtectedPageHeaderLoading
        rightButton={
          <Skeleton className="h-10 w-40" data-testid="loading-skeleton" />
        }
      />
      <ProjectListLoadingContent />
    </LoadingRegion>
  );
}
