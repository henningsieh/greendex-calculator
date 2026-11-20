"use client";

/* eslint-disable shadcn/no-restyle -- This dense project register owns sentence-case sorting controls and compact data-cell typography, distinct from the product's display/action typography. */

import { useTranslations } from "@greendex/i18n/client";
import { useDateFormat } from "@greendex/i18n/datetime/client";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
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
import {
  ArrowDownIcon,
  ArrowDownUpIcon,
  ArrowUpIcon,
  Columns3Icon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";

import { projectPath } from "@/app/paths";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ParticipantsLink } from "@/features/participations/components/participants-link";
import {
  getProjectColumnFilters,
  getProjectSortMode,
  getSortingState,
  isProjectPageSize,
  pushColumnFiltersToUrl,
} from "@/features/projects/components/project-list-filtering";
import { getProjectListQueryOptions } from "@/features/projects/list-query-options";
import type { ProjectListState } from "@/features/projects/list-query-options";
import type { ProjectListQueryState } from "@/features/projects/types";
import type { ProjectListRow } from "@/features/projects/types";
import { Link } from "@/lib/i18n/routing";
import { writePreference } from "@/lib/ui-preferences/browser";
import {
  projectVisibilityPreference,
  type ProjectVisibility,
} from "@/lib/ui-preferences/definitions";
import { cn } from "@/lib/utils";

const projectListTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filterFns: { includesString: filterFn_includesString },
});

function SortHeader({
  label,
  direction,
  priority,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  direction: false | "asc" | "desc";
  priority: number;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}) {
  const t = useTranslations("projects.list");
  const Icon =
    direction === "asc"
      ? ArrowUpIcon
      : direction === "desc"
        ? ArrowDownIcon
        : ArrowDownUpIcon;
  return (
    <Button
      className="-ml-2 h-auto min-h-9 justify-start gap-1 px-2 text-xs font-medium tracking-normal whitespace-nowrap normal-case"
      aria-label={
        direction
          ? t("sortHeaderActive", {
              field: label,
              direction: direction === "asc" ? t("ascending") : t("descending"),
              priority: priority + 1,
            })
          : t("sortHeaderInactive", { field: label })
      }
      data-testid={testId}
      disabled={disabled}
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
    >
      <span className="whitespace-nowrap">{label}</span>
      <Icon aria-hidden="true" data-icon="inline-end" />
      {direction && (
        <span className="flex size-4 items-center justify-center rounded-sm bg-secondary text-xs tabular-nums">
          {priority + 1}
        </span>
      )}
    </Button>
  );
}

function ListMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
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
    <dl className="flex flex-wrap gap-x-6 gap-y-1">
      <ListMetric
        label={
          filtered.projectCount === whole.projectCount
            ? t("metrics.projects")
            : t("metrics.projectsTotal", { count: whole.projectCount })
        }
        value={filtered.projectCount}
      />
      {data.scope === "hosted" && (
        <ListMetric
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
    </dl>
  );
}

export function ResolvedProjectListResults({
  preference,
  scope,
  state,
  urlState,
  setUrlState,
}: {
  preference: { accountKey: string; visibility: ProjectVisibility };
  scope: "hosted" | "partner";
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
  setUrlState: ProjectListQueryState[1];
}) {
  const t = useTranslations("projects.list");
  const dateFormat = useDateFormat();
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >(preference.visibility);

  // Single-element suspense list (not a singular query): the hosted and
  // partner query functions carry incompatible scope-specific tagged key
  // contracts, so only tuple inference keeps both callable here. Do not
  // "simplify" back to useSuspenseQuery.
  const [{ data, dataUpdatedAt, isFetching, refetch }] = useSuspenseQueries({
    queries: [getProjectListQueryOptions(scope, state)],
  });

  const columnFilters = useMemo(
    () => getProjectColumnFilters(urlState),
    [urlState],
  );
  const sorting = useMemo(() => getSortingState(state.sort), [state.sort]);
  // Cursors are opaque, so Table tracks whether this is the first page or a
  // cursor page. The oRPC response supplies the actual forward/backward value.
  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: state.cursor ? 1 : 0,
      pageSize: state.pageSize,
    }),
    [state.cursor, state.pageSize],
  );
  const columns = useMemo<
    ColumnDef<typeof projectListTableFeatures, ProjectListRow>[]
  >(
    () => [
      {
        accessorKey: "name",
        enableHiding: false,
        header: ({ column }) => (
          <SortHeader
            label={t("project")}
            direction={column.getIsSorted()}
            priority={column.getSortIndex()}
            testId="sort-project-name"
            disabled={!isHydrated}
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc", true)
            }
          />
        ),
        cell: ({ row }) => (
          <Link
            className="block truncate font-medium link-prose"
            title={row.original.name}
            href={projectPath(row.original.id)}
            data-testid={`project-link-${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "settlement",
        header: ({ column }) => (
          <SortHeader
            label={t("settlementFilter")}
            direction={column.getIsSorted()}
            priority={column.getSortIndex()}
            testId="sort-project-settlement"
            disabled={!isHydrated}
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc", true)
            }
          />
        ),
        cell: ({ row }) =>
          row.original.settlement === "archived"
            ? t("archive.archived")
            : t(`settlement.${row.original.settlement}`),
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => {
          return (
            <SortHeader
              label={t("startDate")}
              direction={column.getIsSorted()}
              priority={column.getSortIndex()}
              testId="sort-project-start"
              disabled={!isHydrated}
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc", true)
              }
            />
          );
        },
        cell: ({ row }) =>
          dateFormat.format(row.original.startDate, "date.medium"),
      },
      {
        accessorKey: "endDate",
        header: ({ column }) => {
          return (
            <SortHeader
              label={t("endDate")}
              direction={column.getIsSorted()}
              priority={column.getSortIndex()}
              testId="sort-project-end"
              disabled={!isHydrated}
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc", true)
              }
            />
          );
        },
        cell: ({ row }) => dateFormat.format(row.original.endDate, "date.medium"),
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
                <ParticipantsLink
                  density="compact"
                  projectId={row.original.id}
                  testId={`project-participants-${row.original.id}`}
                />
              ),
            } satisfies ColumnDef<
              typeof projectListTableFeatures,
              ProjectListRow
            >,
          ]
        : []),
    ],
    [scope, t, dateFormat, isHydrated],
  );
  const table = useTable({
    columns,
    data: data.rows,
    features: projectListTableFeatures,
    getRowId: (row) => row.id,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onColumnVisibilityChange: (updater) => {
      const next = functionalUpdate(updater, columnVisibility);
      setColumnVisibility(next);
      writePreference(projectVisibilityPreference(preference.accountKey), next);
    },
    onColumnFiltersChange: (updater) => {
      pushColumnFiltersToUrl(
        functionalUpdate(updater, columnFilters),
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
    state: { columnFilters, columnVisibility, pagination, sorting },
  });
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;
  const sortLabels: Record<string, string> = {
    name: t("project"),
    settlement: t("settlementFilter"),
    startDate: t("startDate"),
    endDate: t("endDate"),
  };
  const cellLabels: Record<string, string> = {
    settlement: t("settlementFilter"),
    startDate: t("startDate"),
    endDate: t("endDate"),
    location: t("location"),
    participants: t("participants"),
  };
  const hasActiveFilters = Boolean(
    state.search ||
    state.dateFrom ||
    state.dateTo ||
    state.partnerOrganizationIds.length ||
    state.archive !== "active" ||
    state.settlement !== "all",
  );
  const rows = table.getRowModel().rows;
  const emptyState = (
    <div className="flex flex-col items-center gap-3">
      <span>{t("noMatch")}</span>
      {hasActiveFilters && (
        <Button
          onClick={() =>
            void setUrlState({
              archive: null,
              cursor: null,
              dateFrom: null,
              dateTo: null,
              partnerOrganizationIds: null,
              search: null,
              settlement: null,
            })
          }
          size="sm"
          type="button"
          variant="outline"
        >
          {t("clearFilters")}
        </Button>
      )}
    </div>
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-3"
      data-project-count={whole.projectCount}
      data-filtered-project-count={filtered.projectCount}
    >
      <div className="flex flex-col items-end justify-end gap-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger
              disabled={!isHydrated}
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="project-sort-menu"
                />
              }
            >
              <ArrowDownUpIcon data-icon="inline-start" />
              {t("sort")} <span className="tabular-nums">{sorting.length}</span>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(30rem,calc(100vw-2rem))]"
            >
              <PopoverTitle>{t("sortOrder")}</PopoverTitle>
              <PopoverDescription>{t("sortDescription")}</PopoverDescription>
              <ol className="flex flex-col gap-2">
                {sorting.map((criterion, index) => (
                  <li
                    key={criterion.id}
                    data-testid={`project-sort-rule-${criterion.id}`}
                    className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border p-2"
                  >
                    <span className="mr-1 text-xs text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium">
                      {sortLabels[criterion.id]}
                    </span>
                    <Button
                      className="tracking-normal normal-case"
                      size="xs"
                      variant="ghost"
                      type="button"
                      aria-label={t("toggleSortDirection", {
                        field: sortLabels[criterion.id] ?? criterion.id,
                      })}
                      data-testid={`project-sort-direction-${criterion.id}`}
                      disabled={!isHydrated}
                      onClick={() =>
                        table.setSorting(
                          sorting.map((entry, i) =>
                            i === index ? { ...entry, desc: !entry.desc } : entry,
                          ),
                        )
                      }
                    >
                      {criterion.desc ? (
                        <ArrowDownIcon data-icon="inline-start" />
                      ) : (
                        <ArrowUpIcon data-icon="inline-start" />
                      )}
                      {criterion.desc ? t("descending") : t("ascending")}
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      type="button"
                      aria-label={t("moveSortUp", {
                        field: sortLabels[criterion.id] ?? criterion.id,
                      })}
                      data-testid={`project-sort-up-${criterion.id}`}
                      disabled={!isHydrated || index === 0}
                      onClick={() =>
                        table.setSorting(
                          sorting.map((entry, i) =>
                            i === index - 1
                              ? criterion
                              : i === index
                                ? sorting[index - 1]!
                                : entry,
                          ),
                        )
                      }
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      type="button"
                      aria-label={t("moveSortDown", {
                        field: sortLabels[criterion.id] ?? criterion.id,
                      })}
                      data-testid={`project-sort-down-${criterion.id}`}
                      disabled={!isHydrated || index === sorting.length - 1}
                      onClick={() =>
                        table.setSorting(
                          sorting.map((entry, i) =>
                            i === index + 1
                              ? criterion
                              : i === index
                                ? sorting[index + 1]!
                                : entry,
                          ),
                        )
                      }
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      type="button"
                      aria-label={t("removeSort", {
                        field: sortLabels[criterion.id] ?? criterion.id,
                      })}
                      data-testid={`project-sort-remove-${criterion.id}`}
                      disabled={!isHydrated || sorting.length === 1}
                      onClick={() =>
                        table.setSorting(sorting.filter((_, i) => i !== index))
                      }
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap justify-between gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={
                      !isHydrated ||
                      sorting.length === Object.keys(sortLabels).length
                    }
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid="project-sort-add"
                      />
                    }
                  >
                    {t("addSort")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuGroup>
                      {Object.entries(sortLabels)
                        .filter(
                          ([id]) => !sorting.some((entry) => entry.id === id),
                        )
                        .map(([id, label]) => (
                          <DropdownMenuItem
                            key={id}
                            disabled={!isHydrated}
                            onClick={() =>
                              table.setSorting([...sorting, { id, desc: false }])
                            }
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void setUrlState({ sort: null, cursor: null })}
                  data-testid="project-sort-reset"
                  disabled={!isHydrated}
                >
                  {t("resetSort")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="project-columns-menu"
                />
              }
            >
              <Columns3Icon data-icon="inline-start" />
              {t("columns")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {table
                  .getAllLeafColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      data-testid={`project-column-toggle-${column.id}`}
                      checked={column.getIsVisible()}
                      closeOnClick={false}
                      onCheckedChange={(checked) =>
                        column.toggleVisibility(checked)
                      }
                    >
                      {sortLabels[column.id] ??
                        (column.id === "location"
                          ? t("location")
                          : t("participants"))}
                    </DropdownMenuCheckboxItem>
                  ))}
                <DropdownMenuItem
                  data-testid="project-columns-reset"
                  onClick={() => table.resetColumnVisibility(true)}
                >
                  {t("resetColumns")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label={t("refresh")}
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
            <span className="hidden @lg/content:inline">{t("refresh")}</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-x-3 gap-y-1">
        <p
          className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"
          aria-label={t("sortOrder")}
        >
          {sorting.map((criterion, index) => (
            <span className="inline-flex items-center" key={criterion.id}>
              {index + 1}. {sortLabels[criterion.id]} {criterion.desc ? "↓" : "↑"}
              <span className="sr-only">
                {criterion.desc ? t("descending") : t("ascending")}
              </span>
              <Button
                aria-label={t("removeSort", {
                  field: sortLabels[criterion.id] ?? criterion.id,
                })}
                className="text-muted-foreground"
                data-testid={`sort-summary-remove-${criterion.id}`}
                disabled={sorting.length === 1}
                onClick={() =>
                  table.setSorting(sorting.filter((_, i) => i !== index))
                }
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </span>
          ))}
        </p>

        <p className="hidden flex-nowrap justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground @lg/content:inline">
          <span aria-live="polite">
            {isFetching
              ? t("refreshing")
              : t("updatedAt", {
                  time: dateFormat.format(dataUpdatedAt, "time.seconds"),
                })}
          </span>
        </p>
      </div>

      {/* Desktop: dense table. */}
      <div className="hidden @4xl/content:block">
        <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <Table aria-label={t("label")}>
            <TableHeader className="bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={
                        header.column.id === "name"
                          ? "w-auto whitespace-nowrap"
                          : "w-[15%] px-2 tracking-normal whitespace-nowrap normal-case"
                      }
                      data-testid={`project-column-header-${header.column.id}`}
                      aria-sort={
                        sorting[0]?.id === header.column.id
                          ? sorting[0].desc
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                    >
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
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-28 text-center"
                    colSpan={table.getVisibleLeafColumns().length}
                  >
                    {emptyState}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow data-project-id={row.id} key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "min-w-0 overflow-hidden px-2 text-xs wrap-anywhere",
                          (cell.column.id === "startDate" ||
                            cell.column.id === "endDate") &&
                            "whitespace-nowrap tabular-nums",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Below xl: one card per Project. */}
      <div className="grid gap-3 @4xl/content:hidden">
        {rows.length === 0 ? (
          <div className="rounded-xl border bg-card px-4 py-10">{emptyState}</div>
        ) : (
          rows.map((row) => {
            const [titleCell, ...cellList] = row.getVisibleCells();
            if (!titleCell) return null;
            return (
              <article
                className="rounded-xl border bg-card px-4 py-3.5"
                data-project-id={row.id}
                key={row.id}
              >
                <div className="text-sm font-medium">
                  <Link
                    className="block wrap-anywhere link-prose"
                    data-testid={`project-link-${row.original.id}-card`}
                    href={projectPath(row.original.id)}
                  >
                    {row.original.name}
                  </Link>
                </div>
                <dl className="mt-2 grid grid-cols-[minmax(5.5rem,0.7fr)_minmax(0,1.3fr)] items-baseline gap-x-4 gap-y-1 border-t pt-2">
                  {cellList.map((cell) => (
                    <Fragment key={cell.id}>
                      <dt className="text-xs text-muted-foreground">
                        {cellLabels[cell.column.id]}
                      </dt>
                      <dd className="min-w-0 text-right text-xs wrap-anywhere">
                        {cell.column.id === "participants" ? (
                          <ParticipantsLink
                            density="compact"
                            projectId={row.original.id}
                            testId={`project-participants-${row.original.id}-card`}
                          />
                        ) : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              </article>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("showingCount", {
            shown: data.rows.length,
            total: filtered.projectCount,
          })}
        </p>
        <div className="flex gap-2">
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
    </div>
  );
}
