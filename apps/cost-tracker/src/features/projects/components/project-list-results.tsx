"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
  columnFilteringFeature,
  filterFn_includesString,
  flexRender,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type PaginationState,
  useTable,
} from "@tanstack/react-table";
import { RefreshCwIcon } from "lucide-react";
import { useMemo } from "react";

import { projectParticipantsPath, projectPath } from "@/app/paths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProjectColumnFilters,
  getProjectSortMode,
  getSortingState,
  isProjectPageSize,
  PROJECT_FILTER_IDS,
  pushColumnFiltersToUrl,
  type ProjectListQueryState,
} from "@/features/projects/components/project-list-filtering";
import { getProjectListQueryOptions } from "@/features/projects/list-query-options";
import type { ProjectListState } from "@/features/projects/list-query-options";
import type { ProjectListRow } from "@/features/projects/types";
import { Link } from "@/lib/i18n/routing";

const projectListTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filterFns: { includesString: filterFn_includesString },
});

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        {/* eslint-disable-next-line shadcn/no-restyle -- MetricCard label intentionally uses muted text. */}
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

/**
 * Data-driven list body: metrics, partner filter, refresh row, table, and
 * pagination. Suspends below the tabs and filters, so only this section
 * falls back to the skeleton while a new scope or filter set loads.
 */
export function ProjectListMetrics({
  scope,
  state,
}: {
  scope: "hosted" | "partner";
  state: ProjectListState;
}) {
  const t = useTranslations("projects.list");
  const [{ data }] = useSuspenseQueries({
    queries: [getProjectListQueryOptions(scope, state)],
  });
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label={
          filtered.projectCount === whole.projectCount
            ? t("metrics.projects")
            : t("metrics.projectsTotal", { count: whole.projectCount })
        }
        value={filtered.projectCount}
      />
      <MetricCard
        label={
          filtered.openWindowCount === whole.openWindowCount
            ? t("metrics.windows")
            : t("metrics.windowsTotal", { count: whole.openWindowCount })
        }
        value={filtered.openWindowCount}
      />
      {data.scope === "hosted" && (
        <MetricCard
          label={
            data.metrics.filtered.partnerOrganizationCount ===
            data.metrics.whole.partnerOrganizationCount
              ? t("metrics.partners")
              : t("metrics.partnersTotal", {
                  count: data.metrics.whole.partnerOrganizationCount,
                })
          }
          value={data.metrics.filtered.partnerOrganizationCount}
        />
      )}
    </div>
  );
}

export function ResolvedProjectListResults({
  scope,
  state,
  urlState,
  setUrlState,
}: {
  scope: "hosted" | "partner";
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
  setUrlState: ProjectListQueryState[1];
}) {
  const t = useTranslations("projects.list");
  const dateFormat = useDateFormat();

  // Single-element suspense list (not a singular query): the hosted and
  // partner query functions carry incompatible scope-specific tagged key
  // contracts, so only tuple inference keeps both callable here. Do not
  // "simplify" back to useSuspenseQuery.
  const [{ data, dataUpdatedAt, isFetching, refetch }] = useSuspenseQueries({
    queries: [getProjectListQueryOptions(scope, state)],
  });

  const columnFilters = getProjectColumnFilters(urlState);
  const sorting = getSortingState(state.sort);
  // Cursors are opaque, so Table tracks whether this is the first page or a
  // cursor page. The oRPC response supplies the actual forward/backward value.
  const pagination: PaginationState = {
    pageIndex: state.cursor ? 1 : 0,
    pageSize: state.pageSize,
  };
  const columns = useMemo<
    ColumnDef<typeof projectListTableFeatures, ProjectListRow>[]
  >(
    () => [
      {
        accessorKey: "name",
        enableSorting: false,
        header: t("project"),
        cell: ({ row }) => (
          <Link
            className="font-medium link-prose"
            href={projectPath(row.original.id)}
            data-testid={`project-link-${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => {
          const sortDirection = column.getIsSorted();
          return (
            <Button
              aria-label={t("sortByStartDate")}
              data-testid="sort-project-start"
              onClick={() => column.toggleSorting(sortDirection === "asc")}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("schedule")}
            </Button>
          );
        },
        cell: ({ row }) =>
          dateFormat.range(
            row.original.startDate,
            row.original.endDate,
            "date.medium",
          ),
      },
      {
        id: "location",
        enableSorting: false,
        header: t("location"),
        cell: ({ row }) =>
          [row.original.location, row.original.country]
            .filter(Boolean)
            .join(", "),
      },
      // The Hosting Participant view is a Hosting read (ADR-0016), so Partner rows
      // never link to it; their Partnership workspace keeps its own entry.
      ...(scope === "hosted"
        ? [
            {
              id: "participants",
              enableSorting: false,
              header: t("participants"),
              cell: ({ row }: { row: { original: ProjectListRow } }) => (
                <Link
                  className="link-prose"
                  href={projectParticipantsPath(row.original.id)}
                  data-testid={`project-participants-${row.original.id}`}
                >
                  {t("viewParticipants")}
                </Link>
              ),
            } satisfies ColumnDef<
              typeof projectListTableFeatures,
              ProjectListRow
            >,
          ]
        : []),
      {
        accessorKey: "costSubmissionWindowOpen",
        enableSorting: false,
        header: t("submissionWindow"),
        cell: ({ row }) => (
          <Badge
            data-testid={`project-window-${row.original.id}`}
            data-state={row.original.costSubmissionWindowOpen ? "open" : "closed"}
            variant={
              row.original.costSubmissionWindowOpen ? "default" : "secondary"
            }
          >
            {row.original.costSubmissionWindowOpen ? t("open") : t("closed")}
          </Badge>
        ),
      },
    ],
    [scope, t, dateFormat],
  );
  const table = useTable({
    columns,
    data: data.rows,
    features: projectListTableFeatures,
    getRowId: (row) => row.id,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onColumnFiltersChange: (updater) => {
      pushColumnFiltersToUrl(
        functionalUpdate(updater, columnFilters),
        state,
        urlState,
        setUrlState,
      );
    },
    onPaginationChange: (updater) => {
      const nextPagination = functionalUpdate(updater, pagination);
      if (nextPagination.pageSize !== pagination.pageSize) {
        void setUrlState({
          cursor: null,
          pageSize: isProjectPageSize(nextPagination.pageSize)
            ? nextPagination.pageSize
            : state.pageSize,
        });
        return;
      }

      const cursor =
        nextPagination.pageIndex > pagination.pageIndex
          ? data.nextCursor
          : nextPagination.pageIndex < pagination.pageIndex
            ? data.previousCursor
            : state.cursor;
      void setUrlState({ cursor: cursor ?? null });
    },
    onSortingChange: (updater) => {
      void setUrlState({
        cursor: null,
        sort: getProjectSortMode(functionalUpdate(updater, sorting)),
      });
    },
    pageCount: -1,
    state: { columnFilters, pagination, sorting },
  });
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;

  return (
    <div
      className="space-y-8"
      data-project-count={whole.projectCount}
      data-filtered-project-count={filtered.projectCount}
    >
      {data.scope === "hosted" && data.partnerOptions.length > 0 && (
        <fieldset className="space-y-2 rounded-xl border p-5">
          <legend className="text-sm font-medium">
            {t("partnerOrganizations")}
          </legend>
          <div className="flex flex-wrap gap-3">
            {data.partnerOptions.map((partner) => (
              <label className="flex items-center gap-2 text-sm" key={partner.id}>
                <input
                  data-testid={`project-partner-filter-${partner.id}`}
                  checked={state.partnerOrganizationIds.includes(partner.id)}
                  onChange={(event) => {
                    const ids = event.target.checked
                      ? [...state.partnerOrganizationIds, partner.id]
                      : state.partnerOrganizationIds.filter(
                          (id) => id !== partner.id,
                        );
                    pushColumnFiltersToUrl(
                      [
                        ...columnFilters.filter(
                          (filter) =>
                            filter.id !==
                            PROJECT_FILTER_IDS.partnerOrganizationIds,
                        ),
                        {
                          id: PROJECT_FILTER_IDS.partnerOrganizationIds,
                          value: ids,
                        },
                      ],
                      state,
                      urlState,
                      setUrlState,
                    );
                  }}
                  type="checkbox"
                />
                {partner.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {isFetching
            ? t("refreshing")
            : t("updatedAt", {
                time: dateFormat.format(dataUpdatedAt, "time.seconds"),
              })}
        </span>
        <Button
          disabled={isFetching}
          onClick={() => void refetch()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCwIcon
            aria-hidden="true"
            className={isFetching ? "animate-spin" : undefined}
          />
          {t("refresh")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell className="h-28 text-center" colSpan={columns.length}>
                  {t("noMatch")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow data-project-id={row.id} key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        {data.previousCursor && (
          <Button
            onClick={() => table.previousPage()}
            data-testid="previous-project-page"
            type="button"
            variant="outline"
          >
            {t("previousPage")}
          </Button>
        )}
        <Button
          disabled={!data.nextCursor}
          onClick={() => table.nextPage()}
          data-testid="next-project-page"
          type="button"
          variant="outline"
        >
          {t("nextPage")}
        </Button>
      </div>
    </div>
  );
}
