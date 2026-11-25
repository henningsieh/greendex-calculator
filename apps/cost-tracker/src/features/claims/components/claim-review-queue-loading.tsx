"use client";

import { useTranslations } from "@greendex/i18n/client";
import { Fragment } from "react";

import { LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaimReviewQueueFiltersLoading } from "@/features/claims/components/claim-review-queue-filters-loading";
import { cn } from "@/lib/utils";

const QUEUE_COLUMN_WIDTHS = [
  "w-[18%]",
  "w-[20%]",
  "w-[17%]",
  "w-[13%]",
  "w-[14%]",
  "w-[18%]",
] as const;

export function ClaimReviewQueueLoadingContent() {
  return (
    <section className="mt-6 flex min-w-0 flex-col gap-4">
      <div className="flex h-10 flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Skeleton
          className="h-7 w-48 max-w-full"
          data-testid="loading-skeleton"
        />
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <Skeleton className="h-6 w-34" data-testid="loading-skeleton" />
          <Skeleton className="h-6 w-20" data-testid="loading-skeleton" />
          <Skeleton className="h-6 w-46" data-testid="loading-skeleton" />
        </div>
      </div>

      <ClaimReviewQueueFiltersLoading />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton
          className="h-4 w-40 max-w-full"
          data-testid="loading-skeleton"
        />
        <Skeleton className="h-7 w-24" data-testid="loading-skeleton" />
      </div>

      <div className="hidden @4xl/content:block">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex h-12 items-center border-b bg-muted/40">
            {QUEUE_COLUMN_WIDTHS.map((width, index) => (
              <div className={cn("shrink-0 px-2", width)} key={index}>
                <Skeleton className="h-4 w-3/4" data-testid="loading-skeleton" />
              </div>
            ))}
          </div>
          <div className="divide-y">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="flex items-center" key={index}>
                {QUEUE_COLUMN_WIDTHS.map((width, column) => (
                  <div className={cn("shrink-0 px-2 py-3", width)} key={column}>
                    {/* The status badge is the tallest cell at 24px, so the
                          row keeps the resolved 48px height. */}
                    <Skeleton
                      className={cn(column === 2 ? "h-6 w-20" : "h-4 w-full")}
                      data-testid="loading-skeleton"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 @2xl/content:grid-cols-2 @4xl/content:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="rounded-xl border bg-card px-4 py-3.5" key={index}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Skeleton className="h-5 w-2/3" data-testid="loading-skeleton" />
              <Skeleton
                className="h-6 w-20 shrink-0"
                data-testid="loading-skeleton"
              />
            </div>
            <div className="mt-2 grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 border-t pt-2">
              {Array.from({ length: 3 }, (_, detail) => (
                <Fragment key={detail}>
                  <Skeleton className="h-4 w-16" data-testid="loading-skeleton" />
                  <div className="flex justify-end">
                    <Skeleton
                      className="h-4 w-full max-w-28"
                      data-testid="loading-skeleton"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="mt-2 flex justify-end border-t pt-2">
              <Skeleton className="h-4 w-24" data-testid="loading-skeleton" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton
          className="h-4 w-48 max-w-full"
          data-testid="loading-skeleton"
        />
        <Skeleton className="h-10 w-28" data-testid="loading-skeleton" />
      </div>
    </section>
  );
}

/** Section fallback for the Claims queue boundary. */
export function ClaimReviewQueueLoading() {
  const t = useTranslations("claims.loading");
  return (
    <LoadingRegion label={t("submitted")}>
      <ClaimReviewQueueLoadingContent />
    </LoadingRegion>
  );
}
