"use client";

import { useTranslations } from "@greendex/i18n/client";
import { Fragment } from "react";

import { LoadingRegion } from "@/components/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Mirrors the sort/refresh toolbar: sort-summary chips (h-7 icon buttons),
 * the updated stamp (hidden below lg, like the real one) and the three
 * sm (h-9) action buttons. Row height is driven by the buttons either way.
 */
function ListToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-2 @4xl/content:flex-row @4xl/content:items-center @4xl/content:justify-between">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Skeleton className="h-7 w-28" data-testid="loading-skeleton" />
        <Skeleton className="h-7 w-36" data-testid="loading-skeleton" />
        <Skeleton className="h-7 w-28" data-testid="loading-skeleton" />
      </div>
      <div className="flex items-center justify-between gap-x-4 gap-y-1">
        <Skeleton className="h-7 w-56" data-testid="loading-skeleton" />
        <Skeleton
          className="hidden h-4 w-40 @lg/content:block"
          data-testid="loading-skeleton"
        />
      </div>
    </div>
  );
}

const TABLE_SKELETON_COLUMNS = [
  "w-[16%]",
  "w-[12%]",
  "w-[12%]",
  "w-[12%]",
  "w-[16%]",
  "w-[16%]",
] as const;

/**
 * Desktop register: header row (h-12 + border, sort buttons are min-h-9 so
 * h-5 bars) and body rows (p-3 cells of text-xs) inside the same rounded card.
 * Column shares mirror the fixed table layout; partner scope renders one
 * column fewer, which only changes width, not height.
 */
function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="hidden @4xl/content:block"
      data-testid="project-table-skeleton"
    >
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex h-12 items-center border-b bg-muted/40">
          <div className="min-w-0 flex-1 px-3">
            <Skeleton
              className="h-5 w-24 max-w-full"
              data-testid="loading-skeleton"
            />
          </div>
          {TABLE_SKELETON_COLUMNS.map((width, index) => (
            <div className={cn("shrink-0 px-2", width)} key={index}>
              {/* The Participants column's header is sr-only in the real
                  table, so it paints no bar here either. */}
              {index < TABLE_SKELETON_COLUMNS.length - 1 && (
                <Skeleton className="h-5 w-3/4" data-testid="loading-skeleton" />
              )}
            </div>
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }, (_, index) => (
            <div className="flex items-center" key={index}>
              <div className="min-w-0 flex-1 px-2 py-3">
                <Skeleton className="h-4 w-3/4" data-testid="loading-skeleton" />
              </div>
              {TABLE_SKELETON_COLUMNS.map((width, column) => (
                <div className={cn("shrink-0 px-2 py-3", width)} key={column}>
                  {/* Row height comes from the tallest cell: the settlement
                      badge (24px) and the Participants link (24px). Text-only
                      cells keep the 16px line box. The Participants cell is
                      right-aligned in the real table, so its bar is too. */}
                  <Skeleton
                    className={cn(
                      column === 0 && "h-6 w-20",
                      column === TABLE_SKELETON_COLUMNS.length - 1 &&
                        "ml-auto h-6 w-2/3",
                      column > 0 &&
                        column < TABLE_SKELETON_COLUMNS.length - 1 &&
                        "h-4 w-full",
                    )}
                    data-testid="loading-skeleton"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Below wide: project cards (rounded-xl, px-4 py-3.5) with title row, a
 * four-row detail grid and a trailing action row. Counts are sketched, so
 * card-internal height stays approximate while the outer rhythm is exact.
 */
function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 @2xl/content:grid-cols-2 @4xl/content:hidden">
      {Array.from({ length: count }, (_, index) => (
        <div className="rounded-xl border bg-card px-4 py-3.5" key={index}>
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-2/3" data-testid="loading-skeleton" />
            <Skeleton
              className="h-6 w-20 shrink-0"
              data-testid="loading-skeleton"
            />
          </div>
          <div className="mt-2 grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 border-t pt-2">
            {Array.from({ length: 4 }, (_, detail) => (
              <Fragment key={detail}>
                <Skeleton className="h-4 w-16" data-testid="loading-skeleton" />
                <div className="flex justify-end">
                  <Skeleton
                    className="h-4 w-full max-w-36"
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
  );
}

function ListFooterSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-4 w-48" data-testid="loading-skeleton" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-28" data-testid="loading-skeleton" />
      </div>
    </div>
  );
}

/**
 * Results-only fallback for the client boundary inside the resolved list.
 * Tabs and filters stay mounted (and keep focus) while the register below
 * reloads, so only the toolbar, register and footer are sketched.
 */
export function ProjectListResultsLoadingContent() {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ListToolbarSkeleton />
      <TableSkeleton />
      <CardsSkeleton />
      <ListFooterSkeleton />
    </div>
  );
}

/** Boundary fallback for the register inside the resolved list. */
export function ProjectListResultsLoading() {
  const t = useTranslations("projects.loading");
  return (
    <LoadingRegion label={t("list")}>
      <ProjectListResultsLoadingContent />
    </LoadingRegion>
  );
}
