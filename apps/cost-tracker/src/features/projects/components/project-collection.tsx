"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
  columnFilteringFeature,
  flexRender,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { RefreshCwIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import {
  getProjectCollectionReturnDestination,
  normalizeProjectCollectionState,
  PROJECT_PAGE_SIZES,
  projectCollectionParsers,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
  resolveProjectCollectionState,
} from "@/features/projects/collection-state";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectOverviewQueryOptions,
} from "@/features/projects/project-overview-query-options";

const serverOwnedTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
});

const PROJECT_FILTER_IDS = {
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  name: "name",
  partnerOrganizationIds: "partnerOrganizationIds",
  window: "window",
} as const;

type ProjectRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  location: string;
  country: string;
  costSubmissionWindowOpen: boolean;
};

function getProjectColumnFilters({
  dateFrom,
  dateTo,
  partnerOrganizationIds,
  search,
  window,
}: {
  dateFrom: Date | null;
  dateTo: Date | null;
  partnerOrganizationIds: string[];
  search: string;
  window: (typeof PROJECT_WINDOW_FILTERS)[number];
}): ColumnFiltersState {
  return [
    { id: PROJECT_FILTER_IDS.name, value: search },
    { id: PROJECT_FILTER_IDS.window, value: window },
    { id: PROJECT_FILTER_IDS.dateFrom, value: dateFrom },
    { id: PROJECT_FILTER_IDS.dateTo, value: dateTo },
    {
      id: PROJECT_FILTER_IDS.partnerOrganizationIds,
      value: partnerOrganizationIds,
    },
  ];
}

function getStringFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: string,
) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return typeof value === "string" ? value : fallback;
}

function isProjectWindowFilter(
  value: string,
): value is (typeof PROJECT_WINDOW_FILTERS)[number] {
  return PROJECT_WINDOW_FILTERS.some((filter) => filter === value);
}

function isProjectPageSize(
  value: number,
): value is (typeof PROJECT_PAGE_SIZES)[number] {
  return PROJECT_PAGE_SIZES.some((pageSize) => pageSize === value);
}

function getDateFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: Date | null,
) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return value instanceof Date ? value : fallback;
}

function getStringArrayFilterValue(
  filters: ColumnFiltersState,
  id: string,
  fallback: string[],
) {
  const value = filters.find((filter) => filter.id === id)?.value;
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
}

function getSortingState(
  sort: (typeof PROJECT_SORT_MODES)[number],
): SortingState {
  switch (sort) {
    case "start-asc":
      return [{ id: "startDate", desc: false }];
    case "start-desc":
      return [{ id: "startDate", desc: true }];
    case "end-asc":
      return [{ id: "endDate", desc: false }];
    case "end-desc":
      return [{ id: "endDate", desc: true }];
    default:
      return [{ id: "operational", desc: false }];
  }
}

function getProjectSortMode(sorting: SortingState) {
  const currentSort = sorting[0];
  if (currentSort?.id === "startDate") {
    return currentSort.desc ? "start-desc" : "start-asc";
  }
  if (currentSort?.id === "endDate") {
    return currentSort.desc ? "end-desc" : "end-asc";
  }
  return "operational";
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const updatedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-semibold tabular-nums">
        {value}
      </CardContent>
    </Card>
  );
}

export function ProjectCollection() {
  const [urlState, setUrlState] = useQueryStates(projectCollectionParsers, {
    history: "push",
    shallow: true,
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: availableScopes } = useSuspenseQuery(
    getProjectAvailableScopesQueryOptions(),
  );
  const requestedState = normalizeProjectCollectionState(urlState);
  const resolution = resolveProjectCollectionState(
    requestedState,
    availableScopes,
  );
  const { scope, state } = resolution;
  const fallbackNotices = useRef(new Set<string>());
  const searchTimeout = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(searchTimeout.current), []);

  useEffect(() => {
    if (!resolution.didPartnerToHostedFallback) return;

    const noticeKey = `${requestedState.scope}:${requestedState.cursor ?? ""}`;
    if (fallbackNotices.current.has(noticeKey)) return;

    fallbackNotices.current.add(noticeKey);
    void setUrlState({ cursor: null, scope }, { history: "replace" });
    toast.add({
      description:
        "Partner Projects are unavailable. Hosted Projects are shown instead.",
      title: "Project view updated",
      type: "info",
    });
  }, [
    requestedState.cursor,
    requestedState.scope,
    resolution.didPartnerToHostedFallback,
    scope,
    setUrlState,
  ]);

  const { data, dataUpdatedAt, isFetching, refetch } = useSuspenseQuery(
    getProjectOverviewQueryOptions(scope, state),
  );

  const browserUrl =
    typeof window === "undefined"
      ? { pathname: "/projects", search: "" }
      : window.location;
  const search = searchParams?.toString() ?? browserUrl.search.slice(1);
  const returnTo = getProjectCollectionReturnDestination(
    `${pathname ?? browserUrl.pathname}${search ? `?${search}` : ""}`,
  );

  const columnFilters = getProjectColumnFilters(urlState);
  const sorting = getSortingState(state.sort);
  // Cursors are opaque, so Table tracks whether this is the first page or a
  // cursor page. The oRPC response supplies the actual forward/backward value.
  const pagination: PaginationState = {
    pageIndex: state.cursor ? 1 : 0,
    pageSize: state.pageSize,
  };
  const columns = useMemo<
    ColumnDef<typeof serverOwnedTableFeatures, ProjectRow>[]
  >(
    () => [
      {
        accessorKey: "name",
        enableSorting: false,
        header: "Project",
        cell: ({ row }) => (
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={`/projects/${encodeURIComponent(row.original.id)}?${new URLSearchParams({ returnTo })}`}
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
              aria-label="Sort by start date"
              onClick={() => column.toggleSorting(sortDirection === "asc")}
              size="sm"
              type="button"
              variant="ghost"
            >
              Schedule
            </Button>
          );
        },
        cell: ({ row }) =>
          `${dateFormatter.format(row.original.startDate)} – ${dateFormatter.format(row.original.endDate)}`,
      },
      {
        id: "location",
        enableSorting: false,
        header: "Location",
        cell: ({ row }) =>
          [row.original.location, row.original.country]
            .filter(Boolean)
            .join(", "),
      },
      {
        accessorKey: "costSubmissionWindowOpen",
        enableSorting: false,
        header: "Submission window",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.costSubmissionWindowOpen ? "default" : "secondary"
            }
          >
            {row.original.costSubmissionWindowOpen ? "Open" : "Closed"}
          </Badge>
        ),
      },
    ],
    [returnTo],
  );
  const table = useTable({
    columns,
    data: data.rows,
    features: serverOwnedTableFeatures,
    getRowId: (row) => row.id,
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    onColumnFiltersChange: (updater) => {
      const nextFilters = functionalUpdate(updater, columnFilters);
      const nextWindow = getStringFilterValue(
        nextFilters,
        PROJECT_FILTER_IDS.window,
        state.window,
      );

      void setUrlState({
        cursor: null,
        dateFrom: getDateFilterValue(
          nextFilters,
          PROJECT_FILTER_IDS.dateFrom,
          urlState.dateFrom,
        ),
        dateTo: getDateFilterValue(
          nextFilters,
          PROJECT_FILTER_IDS.dateTo,
          urlState.dateTo,
        ),
        partnerOrganizationIds: getStringArrayFilterValue(
          nextFilters,
          PROJECT_FILTER_IDS.partnerOrganizationIds,
          urlState.partnerOrganizationIds,
        ),
        search: getStringFilterValue(
          nextFilters,
          PROJECT_FILTER_IDS.name,
          urlState.search,
        ),
        window: isProjectWindowFilter(nextWindow) ? nextWindow : state.window,
      });
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

  const updateCollectionState = (patch: Parameters<typeof setUrlState>[0]) =>
    void setUrlState({ ...patch, cursor: null });
  const updateProjectFilter = (
    id: (typeof PROJECT_FILTER_IDS)[keyof typeof PROJECT_FILTER_IDS],
    value: unknown,
  ) =>
    table.setColumnFilters((filters) => [
      ...filters.filter((filter) => filter.id !== id),
      { id, value },
    ]);
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;

  return (
    <section className="mt-10 space-y-8" aria-label="Project collection">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Project relationship"
      >
        <Button
          aria-selected={scope === "hosted"}
          disabled={!availableScopes.hosted && availableScopes.partner}
          onClick={() => updateCollectionState({ scope: "hosted" })}
          role="tab"
          variant={scope === "hosted" ? "default" : "outline"}
        >
          Hosted
        </Button>
        <Button
          aria-selected={scope === "partner"}
          disabled={!availableScopes.partner}
          onClick={() => updateCollectionState({ scope: "partner" })}
          role="tab"
          variant={scope === "partner" ? "default" : "outline"}
        >
          Partner
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={
            filtered.projectCount === whole.projectCount
              ? "Projects"
              : `Projects (${whole.projectCount} total)`
          }
          value={filtered.projectCount}
        />
        <MetricCard
          label={
            filtered.openWindowCount === whole.openWindowCount
              ? "Open windows"
              : `Open windows (${whole.openWindowCount} total)`
          }
          value={filtered.openWindowCount}
        />
        {data.scope === "hosted" && (
          <MetricCard
            label={
              data.metrics.filtered.partnerOrganizationCount ===
              data.metrics.whole.partnerOrganizationCount
                ? "Partner Organizations"
                : `Partner Organizations (${data.metrics.whole.partnerOrganizationCount} total)`
            }
            value={data.metrics.filtered.partnerOrganizationCount}
          />
        )}
      </div>

      <div className="grid gap-5 rounded-xl border p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="project-search">Project name</Label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              defaultValue={urlState.search}
              id="project-search"
              key={urlState.search}
              onChange={(event) => {
                const search = event.target.value;
                window.clearTimeout(searchTimeout.current);
                searchTimeout.current = window.setTimeout(() => {
                  updateProjectFilter(PROJECT_FILTER_IDS.name, search);
                }, 300);
              }}
              placeholder="Search at least 3 characters"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Submission window</Label>
          <Select
            onValueChange={(value) =>
              updateProjectFilter(
                PROJECT_FILTER_IDS.window,
                value && isProjectWindowFilter(value) ? value : state.window,
              )
            }
            value={state.window}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_WINDOW_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "all" ? "All windows" : value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sort</Label>
          <Select
            onValueChange={(value) =>
              table.setSorting(
                getSortingState(
                  PROJECT_SORT_MODES.find((mode) => mode === value) ??
                    "operational",
                ),
              )
            }
            value={state.sort}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">
                Open first, earliest start
              </SelectItem>
              <SelectItem value="start-asc">Start date, earliest</SelectItem>
              <SelectItem value="start-desc">Start date, latest</SelectItem>
              <SelectItem value="end-asc">End date, earliest</SelectItem>
              <SelectItem value="end-desc">End date, latest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Projects per page</Label>
          <Select
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={String(state.pageSize)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_PAGE_SIZES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-date-from">Active on or after</Label>
          <Input
            id="project-date-from"
            onChange={(event) =>
              updateProjectFilter(
                PROJECT_FILTER_IDS.dateFrom,
                event.target.value
                  ? new Date(`${event.target.value}T00:00:00.000Z`)
                  : null,
              )
            }
            type="date"
            value={state.dateFrom?.toISOString().slice(0, 10) ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-date-to">Active on or before</Label>
          <Input
            id="project-date-to"
            onChange={(event) =>
              updateProjectFilter(
                PROJECT_FILTER_IDS.dateTo,
                event.target.value
                  ? new Date(`${event.target.value}T00:00:00.000Z`)
                  : null,
              )
            }
            type="date"
            value={state.dateTo?.toISOString().slice(0, 10) ?? ""}
          />
        </div>
        {data.scope === "hosted" && data.partnerOptions.length > 0 && (
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="text-sm font-medium">
              Partner Organizations (match any)
            </legend>
            <div className="flex flex-wrap gap-3">
              {data.partnerOptions.map((partner) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={partner.id}
                >
                  <input
                    checked={state.partnerOrganizationIds.includes(partner.id)}
                    onChange={(event) => {
                      const ids = event.target.checked
                        ? [...state.partnerOrganizationIds, partner.id]
                        : state.partnerOrganizationIds.filter(
                            (id) => id !== partner.id,
                          );
                      updateProjectFilter(
                        PROJECT_FILTER_IDS.partnerOrganizationIds,
                        ids,
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {isFetching
            ? "Refreshing Projects…"
            : `Updated ${updatedAtFormatter.format(dataUpdatedAt)} UTC`}
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
          Refresh
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
                  No Projects match this scope and filter.
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
            type="button"
            variant="outline"
          >
            Previous page
          </Button>
        )}
        <Button
          disabled={!data.nextCursor}
          onClick={() => table.nextPage()}
          type="button"
          variant="outline"
        >
          Next page
        </Button>
      </div>
    </section>
  );
}
