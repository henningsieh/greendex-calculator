---
applyTo: 'apps/calculator/src/features/projects/**'
description: 'Current project-list sorting and TanStack Table V9 reference'
---

# Project Sorting: Quick Reference

## Source of truth

`apps/calculator/src/features/projects/types.ts` owns the valid project sort fields and the default:

```ts
export const PROJECT_SORT_FIELDS = [
  "name",
  "country",
  "location",
  "startDate",
  "createdAt",
  "updatedAt",
] as const satisfies readonly ProjectSortField[];

export const DEFAULT_PROJECT_SORT = {
  column: "name",
  order: "desc",
} as const satisfies {
  readonly column: ProjectSortField;
  readonly order: "asc" | "desc";
};
```

`getProjectsDefaultSorting()` in `apps/calculator/src/features/projects/utils.ts` converts that domain configuration to TanStack's `SortingState`. Consumers should use the helper rather than reconstructing the array.

## Consumers

| Consumer | Ownership | Source |
| --- | --- | --- |
| Project grid | Client-side filtering and sorting | `components/dashboard/projects-grid.tsx` |
| Project table | Client-side filtering, sorting, pagination, visibility, and selection | `components/dashboard/projects-table.tsx` |
| Project list procedure | Database ordering and organization scoping | `procedures.ts` |

The grid uses `createProjectComparator(sortBy, sortDesc)`. The list procedure uses `computeSortDesc(input)` and `orderByClauseFor(sortField, sortDesc)`. Keep each consumer on those helpers so the default field and direction remain aligned.

## TanStack Table V9

The project table uses the V9 `useTable()` API. Its feature registry is static and lives in `components/dashboard/projects-table-features.ts`:

```ts
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

export const projectsTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
  },
});
```

The table instance receives that registry and the controlled state slices:

```ts
const [sorting, setSorting] = useState<SortingState>(() =>
  getProjectsDefaultSorting(),
);

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
```

### Feature registry rule

In V9, row models and named built-ins belong in `tableFeatures()`, not in `useTable()` options. The core row model is automatic.

| Capability | Feature and slot |
| --- | --- |
| Name filter | `columnFilteringFeature`, `filteredRowModel`, `filterFns.includesString` |
| Sorting | `rowSortingFeature`, `sortedRowModel`, `sortFns` |
| Pagination | `rowPaginationFeature`, `paginatedRowModel` |
| Column visibility | `columnVisibilityFeature` |
| Row selection | `rowSelectionFeature` |

`name` has no explicit `sortFn`, so V9 selects a built-in automatically. Register both `text` and `alphanumeric`: plain names use `text`; names containing numeric segments can use `alphanumeric`. A function supplied directly as a column's `sortFn` needs no registry entry.

## Add a sortable field

1. Confirm the field exists on `projectsTable`.
2. Add it to `PROJECT_SORT_FIELDS` in `types.ts`.
3. Add its translated label in `getColumnDisplayName()`.
4. Add the field's database ordering to `orderByClauseFor()`.
5. Render it in the grid through the existing `createProjectComparator()` flow.
6. Add its table column in `projects-table-columns.tsx` with an `accessorKey` and a direct `sortFn` when special comparison is needed.
7. If the column uses a named or automatic built-in function, register that function in `projectsTableFeatures`.
8. Exercise the grid, table, and list procedure with ascending and descending order.

## Troubleshooting

### `sortFn '<name>' (auto) ... is not registered`

The column omitted `sortFn`, so V9 selected a built-in function that is absent from `projectsTableFeatures.sortFns`. Register only that individual built-in. Do not add the full `sortFns` object; it disables that part of V9's tree-shaking.

### `filterFn 'includesString' (auto) ... is not registered`

The same rule applies to filters. Register `filterFn_includesString` as `filterFns.includesString` in `projectsTableFeatures`.

### Table state does not update

The table controls `sorting`, filters, visibility, selection, and pagination through React state. Each controlled slice needs its corresponding `on…Change` callback. Read reactive state through `table.state`; use `table.store.state` only for a one-off full-store read.

## References

- [Sorting architecture](./sorting-centralization-refactoring.md)
- [TanStack Table React V9 migration guide](https://tanstack.com/table/v9/docs/framework/react/guide/migrating.md)
