"use client";

import { useTranslations } from "@greendex/i18n/client";

import { StatCell, StatGrid } from "@/components/brand/stat-grid";
import {
  CardSkeleton,
  HeaderSkeleton,
  LoadingRegion,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function ListRowsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-10 flex flex-col border-y">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center justify-between gap-6 py-6" key={index}>
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-48" data-testid="loading-skeleton" />
            <Skeleton
              className="h-4 w-72 max-w-full"
              data-testid="loading-skeleton"
            />
          </div>
          <Skeleton className="h-5 w-32" data-testid="loading-skeleton" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsSkeleton() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("projects")}>
      <HeaderSkeleton />
      <ListRowsSkeleton />
    </LoadingRegion>
  );
}

/**
 * List-only fallback for the inner Suspense boundary on the Projects page.
 * The page shell already renders the real header, so only rows are sketched.
 */
export function ProjectListSkeleton() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("list")}>
      <ListRowsSkeleton />
    </LoadingRegion>
  );
}

/**
 * Skeleton twin of the workspace stats strip. Shared by the route loading
 * state and the workspace itself, so numbers and placeholders occupy the
 * same grid and resolving never shifts the layout.
 */
export function StatsSkeletonGrid({
  columns = "three",
  label,
  testId,
}: {
  columns?: "two" | "three";
  label?: string;
  testId?: string;
}) {
  const slots = columns === "three" ? ["a", "b", "c"] : ["a", "b"];
  return (
    <StatGrid
      aria-busy="true"
      aria-label={label}
      columns={columns}
      data-testid={testId}
    >
      {slots.map((slot) => (
        <StatCell key={slot}>
          <Skeleton
            className="h-12 w-16 max-w-full"
            data-testid="loading-skeleton"
          />
          <Skeleton
            className="mt-2 h-4 w-28 max-w-full"
            data-testid="loading-skeleton"
          />
        </StatCell>
      ))}
    </StatGrid>
  );
}

export function ProjectWorkspaceSkeleton() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("workspace")}>
      <div className="flex flex-col gap-8">
        <HeaderSkeleton />
        <StatsSkeletonGrid />
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="flex items-center gap-3" key={index}>
                <Skeleton
                  className="size-5 shrink-0"
                  data-testid="loading-skeleton"
                />
                <Skeleton
                  className="h-5 w-56 max-w-full"
                  data-testid="loading-skeleton"
                />
              </div>
            ))}
          </div>
          <CardSkeleton />
        </div>
      </div>
    </LoadingRegion>
  );
}
