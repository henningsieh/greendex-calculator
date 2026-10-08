---
name: "nuqs"
description: "Type-safe URL search-parameter state, parsers, Next.js adapter, and server parsing"
applyTo: "apps/calculator/src/components/providers/nuqs-adapter.tsx,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/cost-tracker/src/components/nuqs-provider.tsx,apps/cost-tracker/src/features/**/project-list-query-options.ts,apps/cost-tracker/src/features/**/components/**/*.tsx,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx"
---

# nuqs

## Online lookup

For every nuqs change:

1. Confirm the installed `nuqs` version in the owning app's `package.json` and `pnpm-lock.yaml`.
2. Start with the official [nuqs LLM index](https://nuqs.dev/llms.txt), then fetch only the Markdown page for the active concern. Use [Next.js App Router adapters](https://nuqs.dev/docs/adapters#nextjs-app-router) for provider setup.
3. Compare examples with the installed declarations and Greendex source; source and installed types win.
4. Finish when every changed adapter, parser, hook, or server-side concern has an authoritative source.

No official `SKILL.md` is available. The maintainer-authored [nuqs contributor AGENTS.md](https://github.com/47ng/nuqs/blob/next/AGENTS.md) governs contributions to nuqs itself; use it only when working in that upstream repository, not as consumer-app API guidance. The [integration registry](../integrations.md#nuqs) is the aggregate navigation surface.

## Greendex integration

| Concern | Location |
| --- | --- |
| App Router adapter boundary | Owning app's Nuqs provider component |
| Calculator adapter | `apps/calculator/src/components/providers/nuqs-adapter.tsx`, scoped `NuqsProvider` around each consuming subtree (dashboard, projects, workshops) |
| Cost Tracker adapter | `apps/cost-tracker/src/components/nuqs-provider.tsx`, `NuqsProvider` once around the root descendants in `apps/cost-tracker/src/app/layout.tsx` |
| Client URL state | Owning feature component (Cost Tracker: `apps/cost-tracker/src/features/**/project-list-query-options.ts` and feature components) |
| Server URL parsing | Owning page with `nuqs/server` |

Both apps use the App Router adapter, `NuqsAdapter` from `nuqs/adapters/next/app`. The Calculator scopes the provider to the subtrees that use client URL state: the provider itself only stores the adapter (consumers invoke the search-param hook, and its navigation spy carries its own Suspense boundary), so this scoping is policy, not a rendering requirement — keep URL-state context with its consumers instead of implying global availability. The Cost Tracker wraps its root descendants once. Do not use a Pages Router/unified adapter.

## URL-state rules

- Use `useQueryState` for one typed search parameter and `useQueryStates` when one interaction owns a coordinated set of parameters.
- Give every non-string parameter an explicit parser. Reuse a parser definition between server and client consumers when they represent the same URL contract.
- Model constrained UI state with literal or enum parsers; use `.withDefault()` for its in-memory default rather than serializing an absent default into the URL.
- Treat the URL as the shareable state contract: choose stable, semantic parameter names and preserve existing links when changing values or keys.
- Parse search parameters on the server with `nuqs/server` when server-rendered output depends on them; set `shallow: false` only when the update must notify server rendering.
- Keep URL state limited to small, user-meaningful navigation or view state. Keep sensitive, transient, or large state out of query parameters.

## Official entry points

- [Installation](https://nuqs.dev/docs/installation.md) and [basic usage](https://nuqs.dev/docs/basic-usage.md)
- [Built-in parsers](https://nuqs.dev/docs/parsers/built-in.md), [custom parsers](https://nuqs.dev/docs/parsers/making-your-own.md), and [options](https://nuqs.dev/docs/options.md)
- [Multiple search parameters](https://nuqs.dev/docs/batching.md) and [server-side usage](https://nuqs.dev/docs/server-side.md)
- [Testing](https://nuqs.dev/docs/testing.md), [SEO](https://nuqs.dev/docs/seo.md), and [limits](https://nuqs.dev/docs/limits.md)
