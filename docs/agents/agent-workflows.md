# Agent Task Routes

This opt-in router complements `AGENTS.md`. Start at the matching row, then follow the linked map and the integration registry.

## Choose the task route

| Task | Read first | Then use | Primary implementation |
| --- | --- | --- | --- |
| Place or split a module | [Architecture](instructions/architecture.md) | [Developer documentation index](../README.md) | `apps/*/src/`, `packages/*/src/` |
| Add or change an oRPC procedure | [oRPC](instructions/orpc.md) | [oRPC route](integrations.md#orpc) | Owning feature `procedures.ts`, then `lib/orpc/router.ts` |
| Change Query caching, mutations, prefetching, or hydration | [TanStack Query](instructions/tanstack-query.md) | [Query route](integrations.md#tanstack-query) | Query client/hydration utilities and owning consumer |
| Change URL search-parameter state, nuqs parsers, or its Next.js adapter | [nuqs](instructions/nuqs.md) | [nuqs route](integrations.md#nuqs) and the matching local Next.js docs page | Calculator provider, owning page, and feature component |
| Change a data table or migrate v8 examples | [TanStack Table](instructions/tanstack-table.md) | [Table route](integrations.md#tanstack-table) and matching Intent skill | Owning feature table registry, columns, instance, and tests |
| Change SSR data fetching | [Architecture](instructions/architecture.md), [oRPC](instructions/orpc.md), and [TanStack Query](instructions/tanstack-query.md) | [SSR routes](integrations.md#orpc) and matching `.next-docs` page | Server page/layout, hydration utilities, oRPC client seam |
| Change authentication or organizations | [Better Auth](instructions/better-auth.md) | [Shared Project permissions](../projects/permissions.md), current app permissions, and accepted auth ADRs | Owning app auth library and feature |
| Change database schema or migration | [Drizzle](instructions/drizzle.md) | [Drizzle route](integrations.md#drizzle-orm-and-kit) | `packages/database/src/schemas/` and generated migration |
| Change deployment or managed resources | [Coolify](instructions/coolify.md) | [Coolify route](integrations.md#coolify-deployment-and-api) | Coolify-managed configuration; never generated compose output |
| Add or update a UI component/form | [UI components](instructions/shadcn.md) | [shadcn route](integrations.md#shadcnui) | Shared or feature component directory |
| Add translations or locale behavior | [Internationalization](instructions/i18n.md) | [next-intl route](integrations.md#next-intl-and-country-data) | `packages/i18n/src/locales/` and calculator routing |
| Change email templates or delivery | [Email](instructions/email.md) | [Email routes](integrations.md#react-email) | `packages/email/`; calculator transport wiring stays app-specific |
| Change documentation-app behavior | [Documentation application](instructions/documentation-app.md) | [Fumadocs route](integrations.md#fumadocs) | `apps/documentation/` |
| Change dependencies or Turbo tasks | [Workspace](instructions/workspace.md) | Owning manifest and lockfile | Owning workspace plus lockfile |
| Fix or extend questionnaire calculations | [Code standards](instructions/code-standards.md) | [Calculator participation docs](../../apps/calculator/docs/participate/) | `apps/calculator/src/features/participate/` |
| Develop or debug a running Next.js application | [Next.js development and debugging](#nextjs-development-and-debugging) | Matching local Next.js documentation | Discovered development server and affected source |
| Change shared Project identity, participation, or permissions | [Shared Projects](../projects/README.md) | [Context map](../../CONTEXT-MAP.md) and accepted ADRs | Shared database schema and every affected app |
| Change Project Partnerships, Cost Submissions, or allocations | [Cost Tracker Projects](../../apps/cost-tracker/docs/projects/README.md) | [Cost model](../../apps/cost-tracker/docs/domain-model.md) and accepted ADRs | Cost Tracker owning feature and shared database schema |
| Add tests | [Code standards](instructions/code-standards.md) | Relevant feature documentation | Unit/integration or E2E test directory |

## Cross-cutting sequence

1. Read `AGENTS.md`, the required map, and the relevant integration route.
2. Inspect the named source-of-truth files and installed declarations.
3. Implement the smallest coherent change at the owning layer.
4. Add regression coverage at the lowest seam that reproduces the behavior.
5. Run formatting, linting, type checking, and affected tests allowed by `AGENTS.md`.
6. Review the final diff for unrelated files, generated output, and leaked configuration.

## Next.js development and debugging

For a Next.js implementation or diagnosis, use the configured `next-devtools` MCP server; its root configuration is [`.mcp.json`](../../.mcp.json). It is the thin connector to a running Next.js 16+ development server's `/_next/mcp` endpoint. See the official [Next.js MCP guide](https://nextjs.org/docs/app/guides/mcp) and [connector reference](https://github.com/vercel/next-devtools-mcp) when setup or tool behavior changes.

1. Call `next-devtools_nextjs_docs` with the topic and relevant app path, then read the returned version-accurate documentation. For ordinary Next.js work, start at the [local Next.js documentation index](../../.next-docs/index.mdx) too. If that ignored corpus is absent, regenerate it with `pnpm dlx @next/codemod agents-md --output AGENTS.md`, then follow the smallest relevant page set.
2. For runtime diagnosis, route inspection, or live verification, call `next-devtools_nextjs_index` to discover running servers and their exact tool schemas. Choose the target by its returned port; do not assume port 3000 in this monorepo.
3. Call `next-devtools_nextjs_call` only with a tool advertised for that server. Start with `get_errors` for failures; use `get_routes`, metadata, logs, or Turbopack compilation tools when their advertised schemas fit the question. Recheck relevant errors after the change.
4. For browser interaction, screenshots, or client-console investigation, call `next-devtools_browser_eval`, then use the browser automation it directs you to for the verification.

The repository does not authorize starting a development server. If discovery finds none, continue with static inspection and ask the developer to provide or start the intended server; do not infer that a live check passed. The docs and browser gateways provide directions only—the agent still reads the returned documentation and performs the browser work.
