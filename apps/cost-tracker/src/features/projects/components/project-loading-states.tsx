"use client";

import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";

import {
  CardSkeleton,
  HeaderSkeleton,
  LoadingRegion,
} from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

/** Shared layout for resolved metrics and their loading placeholders. */
export function ProjectMetrics({
  columns,
  children,
  ...props
}: {
  columns: "two" | "three";
  children: ReactNode;
  "aria-busy"?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  return (
    <dl
      className={cn(
        "grid divide-x rounded-xl border bg-card",
        columns === "three" ? "grid-cols-3" : "grid-cols-2",
      )}
      {...props}
    >
      {children}
    </dl>
  );
}

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
    <ProjectMetrics
      aria-busy={true}
      aria-label={label}
      columns={columns}
      data-testid={testId}
    >
      {slots.map((slot) => (
        <div
          key={slot}
          className="row-span-3 grid min-w-0 grid-rows-subgrid p-3 sm:px-5"
        >
          <dt aria-hidden="true">
            <Skeleton
              className="h-5 w-24 max-w-full"
              data-testid="loading-skeleton"
            />
          </dt>
          <dd aria-hidden="true">
            <Skeleton className="mt-1 h-8 w-6" data-testid="loading-skeleton" />
          </dd>
          <dd aria-hidden="true">
            <Skeleton
              className="h-5 w-32 max-w-full"
              data-testid="loading-skeleton"
            />
          </dd>
        </div>
      ))}
    </ProjectMetrics>
  );
}

export function ProjectWorkspaceSkeleton() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("workspace")}>
      <div className="flex flex-col gap-6">
        <Skeleton
          className="h-9 w-96 max-w-full"
          data-testid="loading-skeleton"
        />
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Skeleton className="h-9 w-40" data-testid="loading-skeleton" />
          <Skeleton className="h-9 w-24" data-testid="loading-skeleton" />
        </div>
        <StatsSkeletonGrid />
        <CardSkeleton rows={1} />
      </div>
    </LoadingRegion>
  );
}
