"use client";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import type { ColumnDef } from "@tanstack/react-table";
import type z from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { usersTableFeatures } from "@/features/organizations/components/users-table-features";
import type { MemberWithUserSchema } from "@/features/organizations/validation-schemas";
import { SortableHeader } from "@/features/projects/components/sortable-header";

type MemberWithUser = z.infer<typeof MemberWithUserSchema>;

/**
 * Builds the column definitions shared by organization person tables.
 *
 * @param t - Translation function scoped to user-table labels
 * @param tRoles - Translation function scoped to organization roles
 * @param locale - Locale used to format membership dates
 * @returns Typed TanStack Table V9 column definitions for member rows
 */
export function UserTableColumns(
  t: (key: string) => string,
  tRoles: (key: string) => string,
  locale: string,
): ColumnDef<typeof usersTableFeatures, MemberWithUser>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all"
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "member",
      accessorFn: (row) => row.user?.name ?? undefined,
      header: ({ column, table }) => (
        <SortableHeader
          buttonVariant="ghost"
          column={column}
          sorting={table.store.state.sorting}
          title={t("name")}
        />
      ),
      cell: (info) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-5">
            <AvatarImage src={info.row.original.user.image || undefined} />
            <AvatarFallback>
              {info.row.original.user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{String(info.getValue() ?? "")}</span>
        </div>
      ),
    },
    {
      id: "email",
      accessorFn: (row) => row.user?.email ?? undefined,
      header: ({ column, table }) => (
        <SortableHeader
          buttonVariant="ghost"
          column={column}
          sorting={table.store.state.sorting}
          title={t("email")}
        />
      ),
      cell: (info) => <>{String(info.getValue() ?? "")}</>,
    },
    {
      id: "role",
      accessorFn: (row) => row.role ?? undefined,
      header: ({ column, table }) => (
        <SortableHeader
          buttonVariant="ghost"
          column={column}
          sorting={table.store.state.sorting}
          title={t("role")}
        />
      ),
      cell: (info) => (
        <Badge
          variant={
            String(info.getValue()) === ORGANIZATION_ROLES.OrganizationOwner
              ? "default"
              : "secondary"
          }
        >
          {tRoles(String(info.getValue()))}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      accessorFn: (row) => row.createdAt as Date | undefined,
      header: ({ column, table }) => (
        <SortableHeader
          buttonVariant="ghost"
          column={column}
          isNumeric
          sorting={table.store.state.sorting}
          title={t("joined")}
        />
      ),
      cell: (info) => {
        const value = info.getValue() as Date | string | undefined;
        if (!value) {
          return "";
        }
        const date = typeof value === "string" ? new Date(value) : value;
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(date);
      },
      sortFn: (rowA, rowB, columnId) => {
        const dateA = new Date(rowA.getValue(columnId));
        const dateB = new Date(rowB.getValue(columnId));
        return dateA.getTime() - dateB.getTime();
      },
    },
  ];
}
