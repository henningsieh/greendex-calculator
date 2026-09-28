# Cost Tracker prefetch, hydration, and Suspense audit

Scope: Cost Tracker routes and their initial TanStack Query consumers. For the
authoritative agent convention, see
[`tanstack-query.md`](../../../docs/agents/instructions/tanstack-query.md).

## Verdict

All eight protected routes that server-prefetch TanStack Query data now render
an authorized page shell, then await their prefetch in an async child beneath
an **inner Suspense boundary**. They use matching hydrated query options and
an initial-query error boundary. Route-level `loading.tsx` remains the
navigation fallback. The Project detail's real title depends on fetched data,
so its static shell shows a section label instead. Page/layout authorization
still precedes the shell, and navigating away can still cancel the RSC stream.

## Inventory

All eight protected routes that prefetch into `HydrateClient`:

| Route                             | Initial queries                                     | Boundary                | Consumer                                    |
| --------------------------------- | --------------------------------------------------- | ----------------------- | ------------------------------------------- |
| `/projects`                       | scopes, then selected list or assigned-project list | route and inner section | `useSuspenseQuery`                          |
| `/projects/[id]`                  | detail                                              | route and inner section | `useSuspenseQuery`                          |
| `/partner-organizations`          | partnership list                                    | route and inner section | `useSuspenseQuery`                          |
| `/partnerships/[id]/participants` | participant list                                    | route and inner section | `useSuspenseQuery`                          |
| `/partnerships/[id]/claim`        | eight parallel queries                              | route and inner section | `useSuspenseQueries`                        |
| `/claims/review`                  | partnership list, then parallel draft reads         | route and inner section | `useSuspenseQuery` and `useSuspenseQueries` |
| `/claims/review/[id]`             | four parallel queries                               | route and inner section | `useSuspenseQueries`                        |
| `/organization`                   | two parallel queries                                | route and inner section | `useSuspenseQueries`                        |

Sources: `src/app/(protected)/**/page.tsx`, `src/app/(protected)/**/loading.tsx`,
`src/features/projects/components/{project-list,claim-workspace,claim-review,claim-review-queue,project-workspace,participant-coordination,project-partnership-manager,assigned-project-list}.tsx`,
`src/features/organizations/components/organization-team.tsx`. Other routes
do not use this server-prefetch/hydration seam and need not adopt it by default.
The agreed scope is initial page data reads. Session/permission checks,
mutations, input-driven searches, and post-action reads are not initial
page queries. Participant onboarding uses the initial eligibility result to
select profile/agreement steps; retain its state-machine behavior until that
flow is explicitly redesigned.

## What is correct

- `src/lib/tanstack-react-query/client.ts`: positive 60s staleTime, matching
  key serialization and dehydrate/hydrate transforms; pending queries included.
- `src/lib/tanstack-react-query/hydration.tsx`: request-scoped React-cached
  server QueryClient, `HydrationBoundary`. Root `app/layout.tsx` provides one
  browser `QueryClientProvider`; `instrumentation.ts` and root layout retain
  both server oRPC initialization paths.
- In all eight routes, generated oRPC query options are used for prefetches
  and the matching client reads. The multi-query pages launch independent
  prefetches concurrently. `/projects` resolves scope before its dependent
  selected-list query, and shallow nuqs changes use corresponding query keys.
- The client `ProjectDataErrorBoundary` supports initial suspense query retry,
  and the browser provider retains prior cached data on refresh errors.

## Verification and remaining tradeoffs

- `src/app/(protected)/projects/project-streaming.test.tsx` renders the real
  page and async section through React's server stream with a deferred scope
  query. It verifies that the header and skeleton stream before prefetch
  settles. The browser E2E `src/__tests__/e2e/projects.spec.ts` separately
  checks that hydration does not immediately refetch via `/api/rpc`. These
  tests do not prove production response timing under every network condition.
- `project-data-routes.test.tsx` checks the alternative assigned-project
  prefetch. `claim-review-queue.unit.test.tsx` checks that draft failures
  reach the error boundary instead of rendering an empty successful queue.
- `swallowPrefetchError` logs a safe error classification even in production,
  then lets the browser retry an unsuccessful initial query. Logs are coarse
  by design; attach sanitized route/procedure context if the operational
  telemetry later requires it.
- The review queue has an intentional dependency: it must load the partnership
  list before it can start the draft queries. It now prefetches those drafts
  concurrently; for very large lists, a bounded server-side queue procedure
  might be more efficient than one query per partnership.
- The streaming test covers `/projects`; the other pages use the same inner
  boundary topology but do not yet have route-specific delayed-response
  streaming tests. The page/section route tests cover their prefetch choices.

## Agent documentation assessment

`docs/agents/instructions/tanstack-query.md` now routes agents here from its
consumer rules and explains the inner/route-level boundaries, failure/retry
behavior, conditional prefetches, and streaming tests. `docs/README.md`
routes agents to the owning Cost Tracker documentation index, which also links
this audit. Agent instructions are the convention; this audit records the
route-level verification snapshot and the remaining UX/performance tradeoffs.

## Primary references

- Next.js 16.3.6 bundled [Streaming guide](../node_modules/next/dist/docs/01-app/02-guides/streaming.md): `loading.tsx` wraps a page and granular Suspense allows a header to render while async children wait.
- Next.js 16.3.6 bundled [TanStack Query guide](../node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md): pending query hydration, matching keys, Suspense, and warning that independent `useSuspenseQuery` calls run sequentially.
- TanStack Query v5 [Advanced Server Rendering](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr): prefetch + hydration across server/client transitions, pending-query dehydration, and request waterfall tradeoffs.
- Project instructions: [`tanstack-query.md`](../../../docs/agents/instructions/tanstack-query.md), [`orpc.md`](../../../docs/agents/instructions/orpc.md), [`architecture.md`](architecture.md).
