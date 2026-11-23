"use client";

import { useTranslations } from "@greendex/i18n/client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function FilterFieldSkeleton({ wide = false }: { wide?: boolean }) {
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
 * Mirrors ProjectListFilters cell for cell: search (col-span-2 on wide),
 * archive, settlement and page-size selects share the real grid classes, so
 * the card keeps its exact height (one row on wide, two on md, toggle-only
 * on mobile). The collapsed details summary renders as a real
 * details/summary pair — Firefox sizes that pair 0.5px taller than a bare
 * div, so only the real elements reproduce it. The pair is inert (a skeleton
 * must not toggle) and carries the same accessible name as the real control.
 */
export function FiltersSkeleton() {
  const t = useTranslations("projects.list");
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 @4xl/content:grid-cols-5">
        <FilterFieldSkeleton wide />
        <div className="max-md:block md:contents">
          <div className="max-md:flex md:hidden">
            <Skeleton className="h-9.5 w-full" data-testid="loading-skeleton" />
          </div>
          <div
            className="max-md:mt-3 max-md:hidden md:contents"
            data-open={false}
          >
            <FilterFieldSkeleton />
            <FilterFieldSkeleton />
            <FilterFieldSkeleton />
          </div>
        </div>
      </div>
      <details inert>
        <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <span className="sr-only">{t("dateRange")}</span>
          <span
            aria-hidden="true"
            className="inline-block h-3 w-40 animate-pulse bg-muted"
            data-testid="loading-skeleton"
          />
        </summary>
      </details>
    </div>
  );
}
