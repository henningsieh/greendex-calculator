"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** The metric line beside the scope tabs: two `text-sm` values. */
export function ProjectListMetricsLoading() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
      <Skeleton className="h-6 w-32" data-testid="loading-skeleton" />
      <Skeleton className="h-6 w-36" data-testid="loading-skeleton" />
    </div>
  );
}
