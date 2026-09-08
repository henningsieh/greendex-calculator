# Projects Feature Documentation

Use these documents when changing project-list sorting or authorization.

## Sorting

- [Sorting quick reference](./SORTING-QUICKREF.md) — current sort configuration, client and server consumers, and TanStack Table V9 setup.
- [Sorting architecture](./sorting-centralization-refactoring.md) — ownership boundaries and the checklist for adding a sortable project field.

### Current implementation

| Concern | Source of truth |
| --- | --- |
| Sort fields and default | [`apps/calculator/src/features/projects/types.ts`](../../apps/calculator/src/features/projects/types.ts) |
| Shared sort helpers and database ordering | [`apps/calculator/src/features/projects/utils.ts`](../../apps/calculator/src/features/projects/utils.ts) |
| Client grid | [`apps/calculator/src/features/projects/components/dashboard/projects-grid.tsx`](../../apps/calculator/src/features/projects/components/dashboard/projects-grid.tsx) |
| TanStack Table V9 feature registry | [`apps/calculator/src/features/projects/components/dashboard/projects-table-features.ts`](../../apps/calculator/src/features/projects/components/dashboard/projects-table-features.ts) |
| TanStack Table V9 columns | [`apps/calculator/src/features/projects/components/dashboard/projects-table-columns.tsx`](../../apps/calculator/src/features/projects/components/dashboard/projects-table-columns.tsx) |
| TanStack Table V9 instance and controls | [`apps/calculator/src/features/projects/components/dashboard/projects-table.tsx`](../../apps/calculator/src/features/projects/components/dashboard/projects-table.tsx) |
| List procedure | [`apps/calculator/src/features/projects/procedures.ts`](../../apps/calculator/src/features/projects/procedures.ts) |

## Permissions

- [Permissions model](./permissions.md) — Better Auth organization roles and project access control.

## External references

- [TanStack Table project map](../agents/instructions/tanstack-table.md) and [official routes](../agents/integrations.md#tanstack-table)
- [Greendex oRPC rules](../agents/instructions/orpc.md) and [official oRPC routes](../agents/integrations.md#orpc)
- [UI component rules](../agents/instructions/shadcn.md)
- [Internationalization rules](../agents/instructions/i18n.md)
