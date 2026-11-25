"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One labelled filter control: `text-sm` label line, `gap-2`, `h-10` input. */
function QueueFieldLoading({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2",
        wide && "@4xl/content:col-span-2",
      )}
    >
      <Skeleton className="h-5 w-20" data-testid="loading-skeleton" />
      <Skeleton className="h-10 w-full" data-testid="loading-skeleton" />
    </div>
  );
}

/**
 * Loading twin of `ClaimQueueFilters`: the search box spanning two columns,
 * the mobile disclosure and the three selects in the same grid.
 */
export function ClaimReviewQueueFiltersLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 @4xl/content:grid-cols-5">
        <QueueFieldLoading wide />
        <div className="max-md:block md:contents">
          <div className="max-md:flex md:hidden">
            <Skeleton className="h-9.5 w-full" data-testid="loading-skeleton" />
          </div>
          <div
            className="max-md:mt-3 max-md:hidden md:contents"
            data-open={false}
          >
            <QueueFieldLoading />
            <QueueFieldLoading />
            <QueueFieldLoading />
          </div>
        </div>
      </div>
    </div>
  );
}
