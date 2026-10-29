"use client";

import { useTranslations } from "@greendex/i18n/client";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  columnFilteringFeature,
  filterFn_includesString,
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
import { type UseQueryStatesReturn, useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { ProjectDataErrorBoundary } from "@/components/query-data-error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { AssignedProjectList } from "@/features/projects/components/assigned-project-list";
import { CreateProjectDialog } from "@/features/projects/components/create-project-dialog";
import {
  getProjectAvailableScopesQueryOptions,
  getProjectListQueryOptions,
} from "@/features/projects/list-query-options";
import {
  getProjectListReturnDestination,
  normalizeProjectListState,
  type ProjectListState,
  PROJECT_PAGE_SIZES,
  projectListParsers,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
  resolveProjectListState,
  type ProjectListScopeAvailability,
} from "@/features/projects/list-query-options";
import type { ProjectListRow, ProjectListData } from "@/features/projects/types";

const projectListTableFeatures = tableFeatures({
  columnFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filterFns: { includesString: filterFn_includesString },
});

const PROJECT_FILTER_IDS = {
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  name: "name",
  partnerOrganizationIds: "partnerOrganizationIds",
  window: "window",
} as const;

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
  const filter = filters.find((entry) => entry.id === id);
  if (!filter) return fallback;
  return filter.value instanceof Date ? filter.value : null;
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

export function ProjectList() {
  const t = useTranslations("projects.list");
  const { data: availableScopes } = useSuspenseQuery(
    getProjectAvailableScopesQueryOptions(),
  );

  if (!availableScopes.hosted && !availableScopes.partner) {
    if (availableScopes.canCreate) {
      return (
        <>
          <CreateProjectDialog />
          <ProjectDataErrorBoundary resource="Assigned Projects">
            <AssignedProjectList />
          </ProjectDataErrorBoundary>
        </>
      );
    }
    return (
      <Empty
        data-testid="projects-unavailable"
        variant="outlined"
        aria-label={t("label")}
        className="mt-10"
      >
        <EmptyHeader>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {availableScopes.canCreate && <CreateProjectDialog />}
      <ProjectDataErrorBoundary resource="Projects">
        <AvailableProjectList availableScopes={availableScopes} />
      </ProjectDataErrorBoundary>
    </>
  );
}

type ProjectListQueryState = UseQueryStatesReturn<typeof projectListParsers>;

function AvailableProjectList({
  availableScopes,
}: {
  availableScopes: ProjectListScopeAvailability;
}) {
  const [urlState, setUrlState] = useQueryStates(projectListParsers, {
    history: "push",
    shallow: true,
  });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedState = normalizeProjectListState(urlState);
  const resolution = resolveProjectListState(requestedState, availableScopes);

  if (!resolution.scope) {
    return null;
  }

  return (
    <ResolvedProjectList
      availableScopes={availableScopes}
      didPartnerToHostedFallback={resolution.didPartnerToHostedFallback}
      pathname={pathname}
      requestedState={requestedState}
      scope={resolution.scope}
      searchParams={searchParams}
      setUrlState={setUrlState}
      state={resolution.state}
      urlState={urlState}
    />
  );
}

function ProjectListOverview({
  scope,
  availableScopes,
  updateListState,
  data,
}: {
  scope: "hosted" | "partner";
  availableScopes: ProjectListScopeAvailability;
  updateListState: (patch: Parameters<ProjectListQueryState[1]>[0]) => void;
  data: ProjectListData;
}) {
  const t = useTranslations("projects.list");
  const filtered = data.metrics.filtered;
  const whole = data.metrics.whole;
  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("relationship")}
      >
        <Button
          aria-selected={scope === "hosted"}
          data-testid="project-scope-hosted"
          disabled={!availableScopes.hosted && availableScopes.partner}
          onClick={() => updateListState({ scope: "hosted" })}
          role="tab"
          variant={scope === "hosted" ? "default" : "outline"}
        >
          {t("hosted")}
        </Button>
        <Button
          data-testid="project-scope-partner"
          aria-selected={scope === "partner"}
          disabled={!availableScopes.partner}
          onClick={() => updateListState({ scope: "partner" })}
          role="tab"
          variant={scope === "partner" ? "default" : "outline"}
        >
          {t("partner")}
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
    </>
  );
}

function ResolvedProjectList({
  availableScopes,
  didPartnerToHostedFallback,
  pathname,
  requestedState,
  scope,
  searchParams,
  setUrlState,
  state,
  urlState,
}: {
  availableScopes: ProjectListScopeAvailability;
  didPartnerToHostedFallback: boolean;
  pathname: string;
  requestedState: ProjectListState;
  scope: "hosted" | "partner";
  searchParams: ReturnType<typeof useSearchParams>;
  setUrlState: ProjectListQueryState[1];
  state: ProjectListState;
  urlState: ProjectListQueryState[0];
}) {
  const t = useTranslations("projects.list");
  const fallbackNotices = useRef(new Set<string>());
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const searchTimeout = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(searchTimeout.current), []);

  useEffect(() => {
    if (!didPartnerToHostedFallback) return;

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
    didPartnerToHostedFallback,
    scope,
    setUrlState,
  ]);

  // Single-element suspense list (not a singular query): the hosted and
  // partner query functions carry incompatible scope-specific tagged key
  // contracts, so only tuple inference keeps both callable here. Do not
  // "simplify" back to useSuspenseQuery.
  const [{ data, dataUpdatedAt, isFetching, refetch }] = useSuspenseQueries({
    queries: [getProjectListQueryOptions(scope, state)],
  });

  const browserUrl =
    typeof window === "undefined"
      ? { pathname: "/projects", search: "" }
      : window.location;
  const search = searchParams?.toString() ?? browserUrl.search.slice(1);
  const returnTo = getProjectListReturnDestination(
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
    ColumnDef<typeof projectListTableFeatures, ProjectListRow>[]
  >(
    () => [
      {
        accessorKey: "name",
        enableSorting: false,
        header: t("project"),
        cell: ({ row }) => (
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href={`/projects/${encodeURIComponent(row.original.id)}?${new URLSearchParams({ returnTo })}`}
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
          `${dateFormatter.format(row.original.startDate)} – ${dateFormatter.format(row.original.endDate)}`,
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
                  className="underline-offset-4 hover:underline"
                  href={`/projects/${encodeURIComponent(row.original.id)}/participants`}
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
            {row.original.costSubmissionWindowOpen ? "Open" : "Closed"}
          </Badge>
        ),
      },
    ],
    [returnTo, scope, t],
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

  const updateListState = (patch: Parameters<typeof setUrlState>[0]) =>
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
    <section
      aria-label={t("label")}
      className="mt-10 space-y-8"
      data-hydrated={isHydrated ? "true" : undefined}
      data-testid="project-list"
      data-project-count={whole.projectCount}
      data-filtered-project-count={filtered.projectCount}
    >
      <ProjectListOverview
        scope={scope}
        availableScopes={availableScopes}
        updateListState={updateListState}
        data={data}
      />
      <div className="grid gap-5 rounded-xl border p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="project-search">{t("name")}</Label>
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              /* eslint-disable-next-line shadcn/no-restyle -- Search icon overlay requires matching input inset. */
              className="pl-9"
              defaultValue={urlState.search}
              id="project-search"
              data-testid="project-search"
              key={urlState.search}
              onChange={(event) => {
                const search = event.target.value;
                window.clearTimeout(searchTimeout.current);
                searchTimeout.current = window.setTimeout(() => {
                  updateProjectFilter(PROJECT_FILTER_IDS.name, search);
                }, 300);
              }}
              placeholder={t("searchPlaceholder")}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-submission-window">
            {t("submissionWindow")}
          </Label>
          <Select
            onValueChange={(value) =>
              updateProjectFilter(
                PROJECT_FILTER_IDS.window,
                value && isProjectWindowFilter(value) ? value : state.window,
              )
            }
            value={state.window}
          >
            <SelectTrigger
              className="w-full"
              id="project-submission-window"
              data-testid="project-submission-window"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_WINDOW_FILTERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "all" ? t("allWindows") : value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-sort">{t("sort")}</Label>
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
            <SelectTrigger
              className="w-full"
              id="project-sort"
              data-testid="project-sort"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">{t("sortOpenEarliest")}</SelectItem>
              <SelectItem value="start-asc">{t("sortStartEarliest")}</SelectItem>
              <SelectItem value="start-desc">{t("sortStartLatest")}</SelectItem>
              <SelectItem value="end-asc">{t("sortEndEarliest")}</SelectItem>
              <SelectItem value="end-desc">{t("sortEndLatest")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-page-size">{t("perPage")}</Label>
          <Select
            onValueChange={(value) => table.setPageSize(Number(value))}
            value={String(state.pageSize)}
          >
            <SelectTrigger
              className="w-full"
              id="project-page-size"
              data-testid="project-page-size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_PAGE_SIZES.map((value) => (
                <SelectItem
                  data-testid={`project-page-size-${value}`}
                  key={value}
                  value={String(value)}
                >
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-date-from">{t("activeAfter")}</Label>
          <Input
            id="project-date-from"
            data-testid="project-date-from"
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
          <Label htmlFor="project-date-to">{t("activeBefore")}</Label>
          <Input
            id="project-date-to"
            data-testid="project-date-to"
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
              {t("partnerOrganizations")}
            </legend>
            <div className="flex flex-wrap gap-3">
              {data.partnerOptions.map((partner) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  key={partner.id}
                >
                  <input
                    data-testid={`project-partner-filter-${partner.id}`}
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
    </section>
  );
}
