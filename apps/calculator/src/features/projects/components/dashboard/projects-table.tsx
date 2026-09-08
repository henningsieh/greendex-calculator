"use client";

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from "@greendex/config/pagination";
import { useLocale, useTranslations } from "@greendex/i18n/client";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  type ColumnFiltersState,
  type ColumnVisibilityState,
  flexRender,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelXIcon,
  SearchIcon,
  SheetIcon,
  TablePropertiesIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useConfirmDialog } from "@/components/confirm-dialog";
import { Location } from "@/components/location";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MEMBER_ROLES } from "@/features/organizations/types";
import { ProjectTableColumns } from "@/features/projects/components/dashboard/projects-table-columns";
import { projectsTableFeatures } from "@/features/projects/components/dashboard/projects-table-features";
import type { PageSizeOption, ProjectType } from "@/features/projects/types";
import {
  getProjectDetailPath,
  getProjectsDefaultSorting,
} from "@/features/projects/utils";
import { Link } from "@/lib/i18n/routing";
import { orpc, orpcQuery } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";

/**
 * Render an interactive projects table with search, filtering, sorting, pagination, row selection, and batch deletion controls.
 *
 * The table displays the provided projects and exposes UI for filtering by name and country, selecting rows, navigating pages,
 * and performing a batch delete action (when permitted by the user's role). Active filters, selected counts, and an empty-state
 * view are shown as appropriate.
 *
 * @param projects - Array of project objects to display in the table.
 * @returns The JSX element for the projects table including its header controls, table body, pagination footer, and confirm dialog.
 */
export function ProjectsTable({ projects }: { projects: ProjectType[] }) {
  const locale = useLocale();

  const queryClient = useQueryClient();
  const t = useTranslations("organization.projects");
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Fetch active organization
  const { data: memberRole } = useSuspenseQuery(
    orpcQuery.organizations.getRole.queryOptions(),
  );

  // Get unique countries from projects
  const uniqueCountries = useMemo(
    () => [...new Set(projects.map((p) => p.country))],
    [projects],
  );

  // Get columns with translations
  const projectTableColumns = useMemo(
    () => ProjectTableColumns(t, locale),
    [t, locale],
  );

  const [sorting, setSorting] = useState<SortingState>(() =>
    getProjectsDefaultSorting(),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(
    {
      name: true,
      country: true,
      location: true,
      startDate: true,
      createdAt: true,
      updatedAt: false,
    },
  );
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState<{
    pageIndex: number;
    pageSize: PageSizeOption;
  }>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const handlePaginationChange = (updaterOrValue: any) => {
    setPagination((prev) => {
      const newPagination =
        typeof updaterOrValue === "function"
          ? updaterOrValue(prev)
          : updaterOrValue;

      // Ensure pageSize is a valid PageSizeOption
      const validPageSize = PAGE_SIZE_OPTIONS.includes(
        newPagination.pageSize as PageSizeOption,
      )
        ? (newPagination.pageSize as PageSizeOption)
        : DEFAULT_PAGE_SIZE;

      return {
        ...newPagination,
        pageSize: validPageSize,
      };
    });
  };

  const table = useTable({
    features: projectsTableFeatures,
    data: projects,
    columns: projectTableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: handlePaginationChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedProjectIds = selectedRows.map((row) => row.original.id);
  const selectedProjectNames = selectedRows.map((row) => row.original.name);

  const { mutate: batchDeleteMutation, isPending: isBatchDeleting } = useMutation(
    {
      mutationFn: () =>
        orpc.projects.batchDelete({
          projectIds: selectedProjectIds,
        }),
      onSuccess: (result) => {
        if (result.success) {
          toast.success(
            t("form.batch-delete.toast-success", {
              count: result.deletedCount,
            }),
          );
          void queryClient.invalidateQueries({
            queryKey: orpcQuery.projects.list.queryKey(),
          });
          table.resetRowSelection();
        } else {
          toast.error(t("form.batch-delete.toast-error"));
        }
      },
      onError: (err: unknown) => {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        toast.error(message || t("form.batch-delete.toast-error-generic"));
      },
    },
  );

  const handleBatchDelete = async () => {
    const confirmed = await confirm({
      title: t("form.batch-delete.confirm-title"),
      description: t("form.batch-delete.confirm-description", {
        count: selectedProjectIds.length,
        names: selectedProjectNames.join(", "),
      }),
      confirmText: t("form.batch-delete.confirm-button"),
      cancelText: t("form.batch-delete.cancel-button"),
      isDestructive: true,
    });

    if (confirmed) {
      batchDeleteMutation();
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const totalPages = table.getPageCount();
    const currentPage = table.state.pagination.pageIndex;
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      // Show current page and surrounding pages
      const start = Math.max(1, Math.min(currentPage - 1, totalPages - 4));
      const end = Math.min(totalPages - 2, Math.max(currentPage + 1, 3));

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 4) {
        pages.push("ellipsis");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages - 1);
      }
    }

    return pages;
  };

  // Row navigation is handled by per-cell Link wrappers; click handlers removed.

  return (
    <>
      <ConfirmDialogComponent />
      <div className="min-w-0">
        <div className="flex flex-col py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full flex-1">
              <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 w-full border-secondary pl-9 placeholder:text-sm focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary"
                id="project-name-filter"
                onChange={(event) =>
                  table.getColumn("name")?.setFilterValue(event.target.value)
                }
                placeholder={t("table.search-by-name")}
                value={
                  (table.getColumn("name")?.getFilterValue() as string) ?? ""
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                key={`country-filter-${columnFilters.find((f) => f.id === "country")?.value || "none"}`}
                onValueChange={(value) =>
                  setColumnFilters((prev) => {
                    const filtered = prev.filter((f) => f.id !== "country");
                    if (value && value !== "all") {
                      filtered.push({ id: "country", value });
                    }
                    return filtered;
                  })
                }
                value={
                  (columnFilters.find((f) => f.id === "country")
                    ?.value as string) || ""
                }
              >
                <SelectTrigger
                  className="w-full focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary"
                  size="sm"
                >
                  <SelectValue placeholder={t("filter-by-country")} />
                </SelectTrigger>
                <SelectContent>
                  {columnFilters.some((f) => f.id === "country") && (
                    <SelectItem
                      className="focus:bg-secondary focus:text-secondary-foreground"
                      value="all"
                    >
                      {t("table.filter-all-countries")}
                    </SelectItem>
                  )}
                  {uniqueCountries.map((code) => (
                    <SelectItem
                      className="focus:bg-secondary focus:text-secondary-foreground"
                      key={code}
                      value={code}
                    >
                      <Location countryCode={code} locale={locale} showFlag />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge
                className="h-8 gap-1 px-2.5 text-sm font-normal"
                variant="outline"
              >
                <span className="font-medium">
                  {table.getFilteredRowModel().rows.length}
                </span>
                <span className="text-muted-foreground">
                  {table.getFilteredRowModel().rows.length !== projects.length
                    ? `/ ${projects.length}`
                    : ""}
                </span>
                <span className="text-muted-foreground">
                  {t("table.projects-count")}
                </span>
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {memberRole === MEMBER_ROLES.OrganizationAdministrator &&
              selectedRows.length > 0 && (
                <Button
                  disabled={isBatchDeleting}
                  onClick={handleBatchDelete}
                  size="sm"
                  variant="destructive"
                >
                  <Trash2Icon className="mr-2 size-4" />
                  {t("table.batch-delete", {
                    count: selectedRows.length,
                  })}
                </Button>
              )}
          </div>
        </div>
        {columnFilters.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="size-7"
                  disabled={columnFilters.length === 0}
                  onClick={() => setColumnFilters([])}
                  // size="icon-sm"
                  variant="destructive"
                >
                  <FunnelXIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("table.clear-filters")}</TooltipContent>
            </Tooltip>
            <span className="text-sm text-muted-foreground">
              {t("table.active-filters")}:
            </span>
            {columnFilters.map((filter) => {
              if (filter.id === "country") {
                return (
                  <Badge
                    className="px-2 text-xs"
                    key={filter.id}
                    variant="secondaryoutline"
                  >
                    {t("table.country")}:{" "}
                    <Location
                      countryCode={filter.value as string}
                      locale={locale}
                      showFlag
                    />
                  </Badge>
                );
              }
              if (filter.id === "name") {
                return (
                  <Badge
                    className="px-2 text-xs"
                    key={filter.id}
                    variant="secondaryoutline"
                  >
                    {t("table.name")}: {filter.value as string}
                  </Badge>
                );
              }
              return (
                <Badge
                  className="px-2 text-xs"
                  key={filter.id}
                  variant="secondaryoutline"
                >
                  {filter.id}: {filter.value as string}
                </Badge>
              );
            })}
          </div>
        )}
        <div className="max-w-full overflow-x-auto rounded-md border">
          <Table className="mb-4 w-full sm:mb-0">
            <TableHeader className="border-b bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  className="border-b transition-colors"
                  key={headerGroup.id}
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        className={
                          "h-12 px-3 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:px-2"
                        }
                        key={header.id}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {/* <Link
                href={getProjectDetailPath(row.original.id)}
                className="contents"
              > */}
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    className="cursor-pointer transition-colors hover:bg-secondary/10"
                    data-state={row.getIsSelected() && "selected"}
                    key={row.id}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isInteractive = ["select", "actions"].includes(
                        cell.column.id,
                      );
                      return (
                        <TableCell key={cell.id}>
                          {isInteractive ? (
                            // Keep interactive cells as-is (checkboxes / action menus)
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )
                          ) : (
                            // Wrap non-interactive cell content in a link that doesn't add layout
                            <Link
                              href={getProjectDetailPath(row.original.id)}
                              className="contents"
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </Link>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="h-96 text-center"
                    colSpan={projectTableColumns.length}
                  >
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <SearchIcon className="size-6 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>{t("table.no-results.title")}</EmptyTitle>
                        <EmptyDescription>
                          {t("table.no-results.description")}
                        </EmptyDescription>
                      </EmptyHeader>
                      <div className="mt-6">
                        <Button
                          onClick={() => {
                            setColumnFilters([]);
                            table.getColumn("name")?.setFilterValue("");
                          }}
                          variant="outline"
                        >
                          {t("table.clear-filters")}
                        </Button>
                      </div>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
              {/* </Link> */}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {(() => {
              const selectedCount =
                table.getFilteredSelectedRowModel().rows.length;
              const totalCount = table.getFilteredRowModel().rows.length;
              const { pageIndex, pageSize } = table.state.pagination;

              if (selectedCount > 0) {
                return (
                  <span>
                    {selectedCount} of {totalCount} {t("rows-selected")}
                  </span>
                );
              }
              if (totalCount === 0) {
                return <span>{t("table.no-projects-count")}</span>;
              }
              return (
                <span>
                  {t("table.showing-range", {
                    start: pageIndex * pageSize + 1,
                    end: Math.min((pageIndex + 1) * pageSize, totalCount),
                    total: totalCount,
                  })}
                </span>
              );
            })()}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* desktop-only label for rows-per-page */}
            <Label
              className="mr-1 hidden text-sm text-muted-foreground sm:inline"
              htmlFor="projects-rows-per-page"
            >
              {t("table.rows-per-page")}
            </Label>

            <Select
              onValueChange={(value) => {
                const numValue = Number(value) as PageSizeOption;
                if (PAGE_SIZE_OPTIONS.includes(numValue)) {
                  setPagination({ pageIndex: 0, pageSize: numValue });
                }
              }}
              value={pagination.pageSize.toString()}
            >
              <SelectTrigger
                aria-label={t("table.rows-per-page")}
                className="h-8 w-14 shrink-0 focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary sm:w-18"
                id="projects-rows-per-page"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("table.rows-per-page")}</SelectLabel>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <button
                    aria-label="Go to previous page"
                    className={cn(
                      buttonVariants({
                        variant: "secondaryghost",
                        size: "default",
                      }),
                      "gap-1 px-2.5 sm:pl-2.5",
                      !table.getCanPreviousPage() &&
                        "pointer-events-none opacity-50",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanPreviousPage()) {
                        table.previousPage();
                      }
                    }}
                  >
                    <ChevronLeftIcon />
                    <span className="hidden sm:block">Previous</span>
                  </button>
                </PaginationItem>
                {getPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <button
                        aria-current={
                          page === table.state.pagination.pageIndex
                            ? "page"
                            : undefined
                        }
                        className={buttonVariants({
                          variant:
                            page === table.state.pagination.pageIndex
                              ? "secondaryoutline"
                              : "secondaryghost",
                          size: "icon",
                        })}
                        onClick={(e) => {
                          e.preventDefault();
                          table.setPageIndex(page);
                        }}
                      >
                        {page + 1}
                      </button>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <button
                    aria-label="Go to next page"
                    className={cn(
                      buttonVariants({
                        variant: "secondaryghost",
                        size: "default",
                      }),
                      "gap-1 px-2.5 sm:pr-2.5",
                      !table.getCanNextPage() && "pointer-events-none opacity-50",
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      if (table.getCanNextPage()) {
                        table.nextPage();
                      }
                    }}
                  >
                    <span className="hidden sm:block">Next</span>
                    <ChevronRightIcon />
                  </button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Skeleton component for ProjectsTab loading state
 */
export function ProjectsTabSkeleton() {
  const t = useTranslations("organization.projects");

  return (
    <div className="space-y-0">
      <div className="space-y-4">
        {/* View selector skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="flex size-8 items-center justify-center gap-1.5 border border-secondary/60 bg-secondary/40 sm:w-42">
              <TablePropertiesIcon className="size-5 shrink-0 text-muted-foreground" />
              <p className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {t("views.table")}
              </p>
            </Skeleton>
            <Skeleton className="flex size-8 items-center justify-center gap-1.5 border border-secondary/60 bg-secondary/40 sm:w-42">
              <SheetIcon className="size-5 shrink-0 text-muted-foreground" />
              <p className="hidden text-sm font-medium text-muted-foreground sm:inline">
                {t("views.grid")}
              </p>
            </Skeleton>
          </div>
        </div>

        {/* Search + actions skeleton (separate row under view selector) */}
        <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-8 w-full rounded-md border border-secondary bg-secondary/10 sm:w-62.5 lg:w-75" />
            <div className="hidden items-center sm:flex">
              <Skeleton className="h-8 w-45 rounded-md border-secondary/60 bg-secondary/40" />
            </div>
          </div>

          {/* Right side action skeleton (Create button / batch delete) */}
          {/* <div className="flex gap-2 items-center">
            <Skeleton className="w-20 h-8 rounded-md border-secondary/60 bg-secondary/40" />
          </div> */}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="max-w-full overflow-x-auto rounded-md border">
        <div className="mb-4 w-full sm:mb-0">
          {/* Table header skeleton */}
          <div className="border-b bg-muted/50">
            <div className="flex h-12 items-center px-3">
              <Skeleton className="size-4 shrink-0 bg-muted-foreground/20" />
              <Skeleton className="ml-9 h-4 w-64 shrink-0 bg-muted-foreground/20" />
              <Skeleton className="ml-4 size-40 shrink-0 bg-muted-foreground/20" />
              <Skeleton className="ml-4 h-4 w-36 shrink-0 bg-muted-foreground/20" />
              <Skeleton className="ml-4 h-4 w-36 shrink-0 bg-muted-foreground/20" />
              <Skeleton className="mr-7 ml-auto size-6 shrink-0 border border-muted-foreground/40 bg-background" />
            </div>
          </div>

          {/* Table body skeleton */}
          <div className="space-y-0 py-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                className="flex h-12 items-center border-b border-b-muted px-3 last:border-0"
                key={i}
              >
                <Skeleton className="size-4 shrink-0 bg-muted/60" />
                <Skeleton className="ml-10 h-4 w-64 shrink-0 bg-muted/60" />
                <Skeleton className="ml-4 size-40 shrink-0 bg-muted/60" />
                <Skeleton className="ml-4 h-4 w-36 shrink-0 bg-muted/60" />
                <Skeleton className="ml-4 h-4 w-36 shrink-0 bg-muted/60" />
                <Skeleton className="mr-7 ml-auto size-6 shrink-0 border border-secondary/40 bg-background" />
              </div>
            ))}
          </div>

          {/* Footer skeleton (compact, matches responsive layout) */}
          <div className="flex items-center justify-between py-4">
            <Skeleton className="size-45 bg-muted/20" />
            <div className="flex items-center gap-2">
              <Skeleton className="hidden h-4 w-20 bg-muted/20 sm:block" />
              <Skeleton className="h-8 w-18 rounded-md bg-muted/20" />
              <Skeleton className="h-8 w-25 rounded-md bg-muted/20" />
              <Skeleton className="h-8 w-25 rounded-md bg-muted/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
