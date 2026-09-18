"use client";

import { DEFAULT_PAGE_SIZE } from "@greendex/config/pagination";
import { useLocale, useTranslations } from "@greendex/i18n/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { flexRender, type SortingState, useTable } from "@tanstack/react-table";
import { FilterXIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserTableColumns } from "@/features/organizations/components/users-table-columns";
import { usersTableFeatures } from "@/features/organizations/components/users-table-features";
import {
  USERS_SORT_FIELDS,
  type MemberRole,
  type MemberSortField,
} from "@/features/organizations/types";
import { orpcQuery } from "@/lib/orpc/orpc";

import { InviteProjectCoordinatorDialog } from "./invite-project-coordinator-dialog";

interface TeamTableProps {
  organizationId: string;
  roles: MemberRole[];
  showInviteButton?: boolean; // Optional prop to control invite button visibility
  emptyTitle: string;
  emptyDescription: string;
}

export function UsersTable({
  organizationId,
  roles,
  showInviteButton = true,
  emptyTitle,
  emptyDescription,
}: TeamTableProps) {
  const tRoles = useTranslations("organization.roles");
  const t = useTranslations("organization.userstable");
  const locale = useLocale();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState({});

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const sortBy = sorting?.[0]?.id ?? undefined;
  const sortDirection = sorting?.[0]?.desc ? "desc" : "asc";

  // Map table column IDs to procedure sort fields
  let procedureSortBy: MemberSortField | undefined;
  if (sortBy === "member") {
    procedureSortBy = "user.name";
  } else if (sortBy === "email") {
    procedureSortBy = "user.email";
  } else if (USERS_SORT_FIELDS.includes(sortBy as MemberSortField)) {
    procedureSortBy = sortBy as MemberSortField;
  } else {
    procedureSortBy = undefined;
  }

  const { data: membersResult } = useSuspenseQuery(
    orpcQuery.members.search.queryOptions({
      input: {
        organizationId,
        filters: {
          roles,
          search: debouncedSearch || undefined,
          sortBy: procedureSortBy,
          sortDirection,
          limit: pageSize,
          offset: pageIndex * pageSize,
        },
      },
      // keep previous data while fetching new
      keepPreviousData: true,
    }),
  );

  const members = membersResult?.members ?? [];
  const total = membersResult?.total ?? 0;

  const columns = useMemo(
    () => UserTableColumns(t, tRoles, locale),
    [t, tRoles, locale],
  );

  const table = useTable({
    features: usersTableFeatures,
    data: members,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex,
        pageSize,
      },
      rowSelection,
    },
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize) || 0,
    manualSorting: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({
              pageIndex,
              pageSize,
            })
          : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
  });

  const getColumnWidth = (id: string, isHeader: boolean) => {
    if (id === "select") {
      return "w-12";
    }
    if (id === "member") {
      return isHeader ? "pl-10.5" : "";
    }
    if (id === "email") {
      return "";
    }
    if (id === "role") {
      return "w-32";
    }
    return "w-36";
  };

  return (
    <div>
      <div className="flex flex-col gap-6 pb-4 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-3">
          <Input
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("control.filter")}
            value={search}
          />
          <Button
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setPageIndex(0);
            }}
            size="icon"
            variant="outline"
          >
            <FilterXIcon />
            {/* {t("control.clear")} */}
          </Button>
        </div>
        {showInviteButton && (
          <InviteProjectCoordinatorDialog
            allowedRoles={roles}
            onSuccess={() => {
              setPageIndex(0);
            }}
            organizationId={organizationId}
          />
        )}
      </div>
      <div className="rounded-md border">
        <Table className="mb-4 w-full sm:mb-0">
          <TableHeader
            /* eslint-disable-next-line shadcn/no-restyle -- Users table header intentionally has a tinted divider. */
            className="border-b bg-muted/50"
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortState = header.column.getIsSorted();
                  let ariaSort: "ascending" | "descending" | "none" = "none";
                  if (sortState === "asc") {
                    ariaSort = "ascending";
                  } else if (sortState === "desc") {
                    ariaSort = "descending";
                  }

                  return (
                    <TableHead
                      aria-sort={
                        header.column.getCanSort() ? ariaSort : undefined
                      }
                      className={getColumnWidth(header.id, true)}
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
            {(() => {
              if (table.getRowModel().rows?.length > 0) {
                return table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          className={getColumnWidth(cell.column.id, false)}
                          key={cell.id}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ));
              }

              return (
                <TableRow
                  /* eslint-disable-next-line shadcn/no-restyle -- Empty table rows intentionally suppress hover tint. */
                  className="hover:bg-transparent"
                >
                  <TableCell colSpan={columns.length}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <FilterXIcon className="size-9 text-destructive" />
                        </EmptyMedia>
                        <EmptyTitle
                          /* eslint-disable-next-line shadcn/no-restyle -- Empty error title intentionally uses destructive color. */
                          className="text-destructive"
                        >
                          {emptyTitle}
                        </EmptyTitle>
                        <EmptyDescription>{emptyDescription}</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {t("rowsSelected", {
            selected: table.getFilteredSelectedRowModel().rows.length,
            total: table.getFilteredRowModel().rows.length,
          })}
        </div>
        <div className="space-x-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            {t("previous")}
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * TeamTable Skeleton with Shadcn UI table structure
 * Used as a fallback while loading the actual TeamTable
 * implementation: Shadcn Skeletons
 */

const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => `skeleton-${i}`);

export function TeamTableSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Skeleton className="size-4" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SKELETON_ROWS.map((key) => (
            <TableRow key={key}>
              <TableCell>
                <Skeleton className="size-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-8 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
