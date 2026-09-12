---
name: "TanStack Table"
description: "Greendex TanStack Table v9 ownership, bundled package skills, and table-change verification"
applyTo: "apps/calculator/src/features/**/components/**/*table*.ts,apps/calculator/src/features/**/components/**/*table*.tsx,apps/calculator/src/features/**/__tests__/**/*table*.ts,apps/calculator/src/features/**/__tests__/**/*table*.tsx,apps/cost-tracker/src/features/**/components/**/*collection*.tsx,apps/cost-tracker/src/features/**/components/**/*table*.tsx,apps/cost-tracker/src/features/**/__tests__/**/*table*.tsx"
---

# TanStack Table

## Official documentation and bundled skills

1. Confirm the installed `@tanstack/react-table` major in the owning app's `package.json` and `pnpm-lock.yaml`.
2. Start with the official [TanStack Table `latest` index](https://tanstack.com/table/latest/llms.txt), then select pages that match the installed v9 API.
3. Load the matching skill bundled with the installed package at `apps/<app>/node_modules/@tanstack/react-table/skills/<name>/SKILL.md`: `getting-started` for first setup, `table-state` for state ownership, `migrate-v8-to-v9` when touching v8-era code, `with-tanstack-query` / `with-tanstack-virtual` for composition, `create-table-hook` for hook extraction. Follow each skill's `requires` chain into the `@tanstack/table-core` skills (resolved via the owning app's `node_modules`) before applying feature-specific guidance.
4. Inspect the local feature registry, columns, instance, installed declarations, and tests before applying online examples.

The [integration registry](../integrations.md#tanstack-table) is the aggregate navigation surface; this file is the direct route for Table work.

## Greendex rules

- The project uses TanStack Table v9. Do not reintroduce v8 `useReactTable` examples or APIs.
- A table's feature registry, columns, controls, and tests remain owned by its feature. Calculator Project-table sources are documented in [`apps/calculator/docs/projects/README.md`](../../../apps/calculator/docs/projects/README.md).
- Keep table state, accessibility, server-query ownership, and mutations in the owning feature; use [TanStack Query](tanstack-query.md) when table state participates in remote data.
- Verify the table's enabled interaction paths with its existing feature tests.
- For server-authoritative collections, register only the Table features needed to render the returned page. Keep filtering, sorting, aggregates, and cursor pagination in the procedure; do not enable client row-model stages that reinterpret one server page as the complete collection.
