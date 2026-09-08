# Calculator Projects Feature Documentation

Use these documents for Calculator-specific Project sorting and current authorization. Shared Project identity, Project Participation, and target permissions are owned by [`docs/projects/`](../../../../docs/projects/README.md).

## Sorting

- [Sorting quick reference](./SORTING-QUICKREF.md) — current sort configuration, client and server consumers, and TanStack Table V9 setup.
- [Sorting architecture](./sorting-centralization-refactoring.md) — ownership boundaries and the checklist for adding a sortable project field.

### Current implementation

| Concern                                   | Source of truth                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sort fields and default                   | [`src/features/projects/types.ts`](../../src/features/projects/types.ts)                                                                               |
| Shared sort helpers and database ordering | [`src/features/projects/utils.ts`](../../src/features/projects/utils.ts)                                                                               |
| Client grid                               | [`src/features/projects/components/dashboard/projects-grid.tsx`](../../src/features/projects/components/dashboard/projects-grid.tsx)                   |
| TanStack Table V9 feature registry        | [`src/features/projects/components/dashboard/projects-table-features.ts`](../../src/features/projects/components/dashboard/projects-table-features.ts) |
| TanStack Table V9 columns                 | [`src/features/projects/components/dashboard/projects-table-columns.tsx`](../../src/features/projects/components/dashboard/projects-table-columns.tsx) |
| TanStack Table V9 instance and controls   | [`src/features/projects/components/dashboard/projects-table.tsx`](../../src/features/projects/components/dashboard/projects-table.tsx)                 |
| List procedure                            | [`src/features/projects/procedures.ts`](../../src/features/projects/procedures.ts)                                                                     |

## Permissions

- [Permissions model](./permissions.md) — Better Auth organization roles and project access control.

## External references

- [TanStack Table project map](../../../../docs/agents/instructions/tanstack-table.md) and [official routes](../../../../docs/agents/integrations.md#tanstack-table)
- [Greendex oRPC rules](../../../../docs/agents/instructions/orpc.md) and [official oRPC routes](../../../../docs/agents/integrations.md#orpc)
- [UI component rules](../../../../docs/agents/instructions/shadcn.md)
- [Internationalization rules](../../../../docs/agents/instructions/i18n.md)
