---
name: "TanStack React Query"
description: "Query clients, caching, query options, mutations, invalidation, prefetching, SSR, and hydration"
applyTo: "apps/calculator/src/lib/tanstack-react-query/**/*.ts,apps/calculator/src/lib/tanstack-react-query/**/*.tsx,apps/calculator/src/components/providers/query-provider.tsx,apps/calculator/src/lib/orpc/orpc.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/calculator/src/features/**/components/**/*.ts,apps/calculator/src/features/**/components/**/*.tsx,apps/calculator/src/features/**/hooks/**/*.ts,apps/calculator/src/features/**/hooks/**/*.tsx,apps/cost-tracker/src/lib/tanstack-react-query/**/*.ts,apps/cost-tracker/src/lib/tanstack-react-query/**/*.tsx,apps/cost-tracker/src/components/query-provider.tsx,apps/cost-tracker/src/lib/orpc/orpc.ts,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx,apps/cost-tracker/src/features/**/components/**/*.ts,apps/cost-tracker/src/features/**/components/**/*.tsx,apps/cost-tracker/src/features/**/hooks/**/*.ts,apps/cost-tracker/src/features/**/hooks/**/*.tsx"
---

# TanStack React Query

## Online lookup

For every Query change:

1. Confirm the installed `@tanstack/react-query` major in the owning app's `package.json` and `pnpm-lock.yaml`.
2. Use the requested [TanStack Query latest index](https://tanstack.com/query/latest/llms.txt) for discovery, then use the installed major's [v5 index](https://tanstack.com/query/v5/llms.txt) for version-matched guidance. Use the [TanStack product index](https://tanstack.com/llms.txt) only to locate another TanStack product.
3. Fetch only the versioned Markdown pages for the active branch.
4. Compare examples with Greendex source and installed declarations; source and installed types win.
5. Finish when every changed Query concern has an authoritative source.

No dedicated Query skill is installed; use the versioned official pages and installed declarations. The [integration registry](../integrations.md#tanstack-query) is only the aggregate navigation surface.

## Project sources of truth

| Concern | Location |
| --- | --- |
| QueryClient factory, serialization, hash, defaults | Owning app's `src/lib/tanstack-react-query/client.ts` |
| Request QueryClient and hydration boundary | Owning app's `src/lib/tanstack-react-query/hydration.tsx` |
| Browser provider | Owning app's query provider |
| oRPC query options | Owning app's `src/lib/orpc/orpc.ts` |

## Cache and hydration invariants

- `createQueryClient()` owns query-key hashing and cache serialization through the shared serializer.
- Dehydration includes default-eligible and pending queries; hydration uses the matching deserializer.
- React `cache(createQueryClient)` provides the request-rendering QueryClient.
- `QueryProvider` creates one browser QueryClient for its component lifecycle.
- Keep the configured positive `staleTime` so hydrated queries do not refetch immediately on mount.

## Consumers

- Server Components prefetch `orpcQuery.*.queryOptions()` into `getQueryClient()` and render `HydrateClient` before suspense consumers.
- Start independent prefetches together; await only when the route must block. Use `swallowPrefetchError` only where rendering may continue safely.
- For Cost Tracker server-prefetched pages, render the authorization-gated page shell first; place awaited prefetch + `HydrateClient` in an async child inside an inner `<Suspense>` with a section-only fallback. Retain `loading.tsx` for route-level navigation. Data-dependent headings belong in the async section; the outer shell can use a static section label. A boundary does not prevent browser navigation from cancelling the RSC stream.
- This convention applies to initial page data reads, not session/permission gates, mutations, input-driven searches, or post-action reads. Participant onboarding handles its initial agreement/profile eligibility through a state machine; preserve that flow when changing it rather than treating eligibility errors as an ordinary failed suspense query.
- Prefetch **every initial suspense consumer**, including conditionally rendered branches and dependent queries. For independent reads use parallel server queries and `useSuspenseQueries` (or sibling boundaries) when the client might retry on an initial failure; multiple `useSuspenseQuery` calls in one component can waterfall on retries.
- Test the route with a delayed server response: shell/fallback must appear before data, the hydrated view must not immediately refetch via `/api/rpc`, and failures must show a retryable error instead of an empty success state. A mocked page function is not a streaming test.
- Client components consume matching generated query options and use generated mutation options when available.
- Invalidate with oRPC-generated query keys or options rather than reconstructing keys independently.
- Keep server-prefetched data and client-owned revalidation under one ownership model so rendered values cannot diverge.
- Follow [oRPC project rules](orpc.md) when changing generated utilities, server clients, or procedure consumers.
- For Cost Tracker route-specific audit findings and their verification status, open [Prefetch/Suspense audit](../../../apps/cost-tracker/docs/prefetch-suspense-audit.md) when changing its server-prefetched routes. Treat this instruction file as the convention; the audit is a snapshot, not another source of rules.

## Official v5 entry points

- Foundation: [overview](https://tanstack.com/query/v5/docs/framework/react/overview.md), [important defaults](https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults.md), [QueryClient](https://tanstack.com/query/v5/docs/reference/QueryClient.md), [query options](https://tanstack.com/query/v5/docs/framework/react/guides/query-options.md), [query keys](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys.md)
- Writes: [mutations](https://tanstack.com/query/v5/docs/framework/react/guides/mutations.md), [invalidation from mutations](https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations.md)
- SSR: [advanced SSR](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr.md), [SSR and hydration](https://tanstack.com/query/v5/docs/framework/react/guides/ssr.md), [request waterfalls](https://tanstack.com/query/v5/docs/framework/react/guides/request-waterfalls.md), [prefetching](https://tanstack.com/query/v5/docs/framework/react/guides/prefetching.md), [hydration](https://tanstack.com/query/v5/docs/framework/react/reference/hydration.md)
- Additional branches: [suspense](https://tanstack.com/query/v5/docs/framework/react/guides/suspense.md), [testing](https://tanstack.com/query/v5/docs/framework/react/guides/testing.md)
