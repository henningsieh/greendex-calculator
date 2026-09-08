---
applyTo: 'apps/calculator/src/features/projects/**'
description: 'Project-list sorting architecture across the grid, TanStack Table V9, and database procedure'
---

# Project Sorting Architecture

Project-list sorting has one domain configuration and three consumers. The boundary is deliberate: domain defaults stay independent of a renderer, while each consumer owns the processing appropriate to its data source.

```text
DEFAULT_PROJECT_SORT and PROJECT_SORT_FIELDS
                    │
                    ▼
     getProjectsDefaultSorting / comparator / SQL ordering helpers
          │                    │                    │
          ▼                    ▼                    ▼
       Grid view          Table V9            List procedure
    in-memory rows     in-memory rows        database rows
```

## Domain configuration

`apps/calculator/src/features/projects/types.ts` defines:

- `ProjectSortField`, inferred from the database table.
- `PROJECT_SORT_FIELDS`, the fields exposed by project-list controls.
- `DEFAULT_PROJECT_SORT`, the default field and direction.

`apps/calculator/src/features/projects/utils.ts` owns the conversions and comparisons:

- `getProjectsDefaultSorting()` converts the domain default to TanStack `SortingState`.
- `createProjectComparator()` sorts grid rows.
- `computeSortDesc()` and `orderByClauseFor()` select the list procedure's database ordering.
- `getColumnDisplayName()` maps a field to its localized table label.

Keep policy in these modules. UI components should consume these helpers rather than encode a second default or comparison rule.

## Consumer ownership

### Grid

`components/dashboard/projects-grid.tsx` filters and sorts the loaded project array in memory. It initializes from `DEFAULT_PROJECT_SORT`, derives a comparator with `createProjectComparator()`, and applies that comparator in its memoized list.

### Table

`components/dashboard/projects-table.tsx` owns client-side table state and passes it to `useTable()`. `components/dashboard/projects-table-features.ts` owns the static `projectsTableFeatures` registry, and `components/dashboard/projects-table-columns.tsx` owns the typed columns.

The V9 registry explicitly declares the enabled behavior:

```ts
export const projectsTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
  },
});
```

The core row model is automatic. V9 row-model factories and function registries are feature slots, so they do not belong in `useTable()` options.

Table columns may supply a callable `sortFn` directly for domain-specific ordering, such as localized country names and dates. Columns without a callable use V9's automatic resolver; any automatic built-in they may select must appear in `sortFns`.

### List procedure

`procedures.ts` scopes the query to the active organization and obtains its SQL order with `computeSortDesc()` plus `orderByClauseFor()`. The procedure is the authority for database ordering; client table sorting only reorders the projects already loaded for the current view.

## Adding a sort field

A change is complete when all applicable consumers accept the field and preserve the configured default behavior:

1. Add the database field, then include it in `PROJECT_SORT_FIELDS`.
2. Update `getColumnDisplayName()` and translations.
3. Add a case to `orderByClauseFor()`.
4. Confirm the grid comparator handles the field's value type.
5. Add the table column and choose either a callable `sortFn` or a registered built-in.
6. Register every V9 feature, row model, and named function the new column requires in `projects-table-features.ts`.
7. Verify ascending and descending ordering in the grid, table, and list procedure.

## V9 migration invariants

- Construct project tables with `useTable({ features, ... })`.
- Put `createFilteredRowModel()`, `createSortedRowModel()`, and `createPaginatedRowModel()` in `tableFeatures()` under their corresponding slots.
- Register individual built-ins in `filterFns` and `sortFns`. The automatic `"auto"` resolver only finds registered functions.
- Use `sortFn` for a column's sorting function.
- Read component-reactive state from `table.state`. Use `table.store.state` for a one-off full-store read when needed.
- Invoke row, cell, column, and header methods on their instance; V9 methods are prototype-based.

## References

- [Quick reference](./SORTING-QUICKREF.md)
- [TanStack Table React V9 migration guide](https://tanstack.com/table/v9/docs/framework/react/guide/migrating.md)
