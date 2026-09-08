# Agent Task Routes

This opt-in router complements `AGENTS.md`. Start at the matching row, then follow the linked map and the integration registry.

## Choose the task route

| Task | Read first | Then use | Primary implementation |
| --- | --- | --- | --- |
| Place or split a module | [Architecture](instructions/architecture.md) | [Developer documentation index](../README.md) | `apps/*/src/`, `packages/*/src/` |
| Add or change an oRPC procedure | [oRPC](instructions/orpc.md) | [oRPC route](integrations.md#orpc) | Owning feature `procedures.ts`, then `lib/orpc/router.ts` |
| Change Query caching, mutations, prefetching, or hydration | [TanStack Query](instructions/tanstack-query.md) | [Query route](integrations.md#tanstack-query) | Query client/hydration utilities and owning consumer |
| Change a data table or migrate v8 examples | [TanStack Table](instructions/tanstack-table.md) | [Table route](integrations.md#tanstack-table) and matching Intent skill | Owning feature table registry, columns, instance, and tests |
| Change SSR data fetching | [Architecture](instructions/architecture.md), [oRPC](instructions/orpc.md), and [TanStack Query](instructions/tanstack-query.md) | [SSR routes](integrations.md#orpc) and matching `.next-docs` page | Server page/layout, hydration utilities, oRPC client seam |
| Change authentication or organizations | [Better Auth](instructions/better-auth.md) | [Better Auth route](integrations.md#better-auth) and [permissions](../projects/permissions.md) | Calculator Better Auth library and owning feature |
| Change database schema or migration | [Drizzle](instructions/drizzle.md) | [Drizzle route](integrations.md#drizzle-orm-and-kit) | `packages/database/src/schemas/` and generated migration |
| Change deployment or managed resources | [Coolify](instructions/coolify.md) | [Coolify route](integrations.md#coolify-deployment-and-api) | Coolify-managed configuration; never generated compose output |
| Add or update a UI component/form | [UI components](instructions/shadcn.md) | [shadcn route](integrations.md#shadcnui) | Shared or feature component directory |
| Add translations or locale behavior | [Internationalization](instructions/i18n.md) | [next-intl route](integrations.md#next-intl-and-country-data) | `packages/i18n/src/locales/` and calculator routing |
| Change email templates or delivery | [Email](instructions/email.md) | [Email routes](integrations.md#react-email) | `packages/email/`; calculator transport wiring stays app-specific |
| Change documentation-app behavior | [Documentation application](instructions/documentation-app.md) | [Fumadocs route](integrations.md#fumadocs) | `apps/documentation/` |
| Change dependencies or Turbo tasks | [Workspace](instructions/workspace.md) | Owning manifest and lockfile | Owning workspace plus lockfile |
| Fix or extend questionnaire calculations | [Code standards](instructions/code-standards.md) | [Participation docs](../participate/) | `apps/calculator/src/features/participate/` |
| Add tests | [Code standards](instructions/code-standards.md) | Relevant feature documentation | Unit/integration or E2E test directory |

## Cross-cutting sequence

1. Read `AGENTS.md`, the required map, and the relevant integration route.
2. Inspect the named source-of-truth files and installed declarations.
3. Implement the smallest coherent change at the owning layer.
4. Add regression coverage at the lowest seam that reproduces the behavior.
5. Run formatting, linting, type checking, and affected tests allowed by `AGENTS.md`.
6. Review the final diff for unrelated files, generated output, and leaked configuration.

## Next.js work

For any Next.js task, start at the [local Next.js documentation index](../../.next-docs/index.mdx). If the ignored corpus is absent, regenerate it with `pnpm dlx @next/codemod agents-md --output AGENTS.md`, then follow the smallest relevant page set.
