---
name: "nuqs"
description: "Type-safe URL search-parameter state, parsers, Next.js adapter, and server parsing"
applyTo: "apps/calculator/src/components/providers/nuqs-adapter.tsx,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx"
---

# nuqs

## Online lookup

For every nuqs change:

1. Confirm the installed `nuqs` version in `apps/calculator/package.json` and `pnpm-lock.yaml`.
2. Start with the official [nuqs LLM index](https://nuqs.dev/llms.txt), then fetch only the Markdown page for the active concern. Use [Next.js App Router adapters](https://nuqs.dev/docs/adapters#nextjs-app-router) for provider setup.
3. Compare examples with the installed declarations and Greendex source; source and installed types win.
4. Finish when every changed adapter, parser, hook, or server-side concern has an authoritative source.

No official `SKILL.md` is available. The maintainer-authored [nuqs contributor AGENTS.md](https://github.com/47ng/nuqs/blob/next/AGENTS.md) governs contributions to nuqs itself; use it only when working in that upstream repository, not as consumer-app API guidance. The [integration registry](../integrations.md#nuqs) is the aggregate navigation surface.

## Greendex integration

| Concern | Location |
| --- | --- |
| App Router adapter boundary | `apps/calculator/src/components/providers/nuqs-adapter.tsx` |
| Adapter placement | `apps/calculator/src/app/[locale]/layout.tsx` |
| Client URL state | Owning Calculator feature component |
| Server URL parsing | Owning Calculator page with `nuqs/server` |

The Calculator uses the App Router adapter, `NuqsAdapter` from `nuqs/adapters/next/app`, once around the locale layout's descendants. Preserve that boundary when adding client URL state; do not add feature-local adapters or use a Pages Router/unified adapter.

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
