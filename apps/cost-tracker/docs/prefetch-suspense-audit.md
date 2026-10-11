# Cost Tracker prefetch, hydration, and Suspense audit

Scope: Cost Tracker routes and their initial TanStack Query consumers. For the
authoritative agent convention, see
[`tanstack-query.md`](../../../docs/agents/instructions/tanstack-query.md).

## Verdict

All ten protected routes that server-prefetch TanStack Query data render
an authorized page shell, then await their prefetch in an async child beneath
an **inner Suspense boundary**. They use matching hydrated query options and
an initial-query error boundary. Route-level `loading.tsx` remains the
navigation fallback. Cache Components is enabled, with deliberate request-bound
authentication gates matching Calculator. Claim and Project Partnership surfaces
use feature-owned card/document skeletons in both inner and navigation boundaries.
The Project detail's real title depends on fetched data,
so its static shell shows a section label instead. Page/layout authorization
still precedes the shell, and navigating away can still cancel the RSC stream.

## Inventory

All ten protected routes that prefetch into `HydrateClient`:

| Route                                               | Initial queries                                     | Boundary                | Consumer                                    |
| --------------------------------------------------- | --------------------------------------------------- | ----------------------- | ------------------------------------------- |
| `/projects`                                         | scopes, then selected list or assigned-project list | route and inner section | `useSuspenseQuery`                          |
| `/projects/[id]`                                    | detail                                              | route and inner section | `useSuspenseQuery`                          |
| `/partner-organizations`                            | partnership list                                    | route and inner section | `useSuspenseQuery`                          |
| `/partnerships/[id]/participants`                   | participant list                                    | route and inner section | `useSuspenseQuery`                          |
| `/partnerships/[id]/participants/[participationId]` | participant detail                                  | route and inner section | `useSuspenseQuery`                          |
| `/projects/[id]/participants`                       | Hosting Participant report                          | route and inner section | `useSuspenseQuery`                          |
| `/partnerships/[id]/claim`                          | eight parallel queries                              | route and inner section | `useSuspenseQueries`                        |
| `/claims/review`                                    | partnership list, then parallel draft reads         | route and inner section | `useSuspenseQuery` and `useSuspenseQueries` |
| `/claims/review/[id]`                               | four parallel queries                               | route and inner section | `useSuspenseQueries`                        |
| `/organization`                                     | three parallel queries                              | route and inner section | `useSuspenseQueries`                        |

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
- In all ten routes, generated oRPC query options are used for prefetches
  and the matching client reads. The multi-query pages launch independent
  prefetches concurrently. `/projects` resolves scope before its dependent
  selected-list query, and shallow nuqs changes use corresponding query keys.
- The client `ProjectDataErrorBoundary` supports initial suspense query retry,
  and the browser provider retains prior cached data on refresh errors. On
  `/projects`, nested list boundaries keep an independently permitted “New
  project” dialog visible when a selected/assigned-list query denies access
  (#206); `hosting-setup.spec.ts` exercises disposable Project creation by an
  unassigned `coordinator` in the browser. ADR-0012 forbids the fallback role.

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
- `src/app/(protected)/project-partnership-streaming.test.tsx` covers the other
  eight Claim/Project Partnership surfaces in the inventory: Claim workspace,
  review queue/detail, Partnership participants/detail, Hosting report, Partner
  Organization management, and Project detail. Deferred query tests assert that
  the authorized heading and matching card skeleton stream before data, then
  resolve to content. Deferred URL-promise tests cover every dynamic identity
  surface. Page tests also assert no rendering/prefetch without Membership.
- `project-loading-states.unit.test.tsx` verifies accessible section and matching
  route-level fallbacks. `layout.test.tsx` pins the request boundary before the
  unchanged active Organization recovery flow.
- These stream tests use the real page and section composition with mocked data
  and leaf views. They do not establish production browser first-paint timing,
  absence of hydration refetch, or error retry UX; live-browser verification is
  still required. `/organization` keeps the existing generic skeleton because
  it is outside the Claim/Project Partnership loading scope.

## Intentional request-bound gates

The protected layout retains its authentication and active Organization gates
before paint with `instant = false` and `await connection()`. Seven routes outside
it retain their original gate order via documented `instant = false` exports:
`/login`, `/register`, `/accept-invitation/[invitationId]`, `/setup-links/[id]`,
`/participant`, `/participant-links/[id]`, and
`/participant-invitations/[invitationId]`. Existing request APIs already keep
these seven routes request-bound; no additional `connection()` is necessary.
The onboarding eligibility state machine is not restructured.

## Agent documentation assessment

`docs/agents/instructions/tanstack-query.md` now routes agents here from its
consumer rules and explains the inner/route-level boundaries, failure/retry
behavior, conditional prefetches, and streaming tests. The owning
[architecture guide](architecture.md#cache-components-and-request-bound-loading)
adds the installed adoption/dev-loop/shadcn skill routes and version-matched Next
doc discovery, request-bound gate decisions, and the deliberate decision not to
change Partial Prefetching behavior. `docs/README.md`
routes agents to the owning Cost Tracker documentation index, which also links
this audit. Agent instructions are the convention; this audit records the
route-level verification snapshot and the remaining UX/performance tradeoffs.

## Primary references

- Installed Next.js bundled [Streaming guide](../../../node_modules/next/dist/docs/01-app/02-guides/streaming.md): `loading.tsx` wraps a page and granular Suspense allows a header to render while async children wait.
- Installed Next.js bundled [TanStack Query guide](../../../node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md): pending query hydration, matching keys, Suspense, and warning that independent `useSuspenseQuery` calls run sequentially.
- TanStack Query v5 [Advanced Server Rendering](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr): prefetch + hydration across server/client transitions, pending-query dehydration, and request waterfall tradeoffs.
- Project instructions: [`tanstack-query.md`](../../../docs/agents/instructions/tanstack-query.md), [`orpc.md`](../../../docs/agents/instructions/orpc.md), [`architecture.md`](architecture.md).

## Partial Prefetching adoption (#259)

This section supersedes the earlier blocking-layout/prefetch snapshot above.
Cost Tracker now sets `partialPrefetching: true`. The synchronous protected
layout wraps the unchanged request-time gate in Suspense. Neutral brand chrome
and Skeletons paint without session data, navigation actions, or children; the
async protected shell resolves `connection()`, session, Memberships, recovery,
and permission flags before exposing personalized navigation and page content.
Login redirects and inline Organization recovery remain server-side. Brief
neutral-shell paint before recovery is accepted. Page/procedure authorization,
Claim grouping, Cost Allocation, payout logic, and Participant Journey persistence
are unchanged.

### Complete page/layout inventory

“Improved” means entry through the protected layout now has a static neutral
shell; it does not promise that private page content is prefetched. Shared-layout
client navigations rely on the existing route loading/inner boundaries, not the
layout fallback above the shared segment.

| Route                                               | Classification                | Shell/data decision                                                    |
| --------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `/`                                                 | Deferred (already static)     | Public landing content unchanged                                       |
| `/login`                                            | Exception                     | Signed-in redirect before form; no form flash                          |
| `/register`                                         | Exception                     | Signed-in redirect before form; no form flash                          |
| `/accept-invitation/[invitationId]`                 | Exception                     | Recipient/session checks, request-bound return destination             |
| `/setup-links/[id]`                                 | Exception                     | Secret-preserving return URL and recipient checks                      |
| `/participant`                                      | Exception                     | Session and onboarding eligibility state machine                       |
| `/participant-links/[id]`                           | Exception                     | Request-time link source/secret and onboarding state machine           |
| `/participant-invitations/[invitationId]`           | Exception                     | Request-time invitation source and onboarding state machine            |
| `/projects`                                         | Improved                      | Neutral entry shell; scope/list and searchParams behind inner boundary |
| `/projects/[id]`                                    | Improved                      | Neutral entry shell; identity/detail inside boundary                   |
| `/projects/[id]/participants`                       | Improved                      | Neutral entry shell; identity/Hosting report inside boundary           |
| `/partner-organizations`                            | Improved                      | Neutral entry shell; Partnership list inside boundary                  |
| `/partnerships/[id]/participants`                   | Improved                      | Neutral entry shell; identity/Participant list inside boundary         |
| `/partnerships/[id]/participants/[participationId]` | Improved                      | Neutral entry shell; identities/Participant detail inside boundary     |
| `/partnerships/[id]/claim`                          | Improved                      | Neutral entry shell; identity/eight Claim queries inside boundary      |
| `/claims/review`                                    | Improved                      | Neutral entry shell; list then drafts inside boundary                  |
| `/claims/review/[id]`                               | Improved                      | Neutral entry shell; identity/four review queries inside boundary      |
| `/organization`                                     | Improved                      | Neutral entry shell; three queries inside boundary                     |
| `/user-settings`                                    | Improved entry; page deferred | Existing request-bound session read; no page restructuring             |

All three layouts: root `app/layout.tsx` retains providers and the server oRPC
side-effect import; `(auth)/layout.tsx` retains static public chrome;
`(protected)/layout.tsx` is the new static fallback/streaming gate. There is no
setup layout or dashboard page. API Route Handlers are not navigation shells and
remain request-bound (including authenticated Proof Document downloads).
There are **seven retained page exports**, not eight; the eighth previous
`instant = false` export was on the protected layout and has been removed.

### Complete Link inventory and decisions

Source scan of all Cost Tracker `next/link` imports and JSX props found **zero
`prefetch={true}` (or bare/conditional prefetch) Links**. All Links retain default
`auto`; no Link wrapper supplies a full-prefetch override.

| Source under `src/`                                                         | Destinations                                                                                                         | Decision                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `app/page.tsx`                                                              | login, register                                                                                                      | Default public/auth shell                           |
| `components/site-brand.tsx`                                                 | `/` by default; `/projects` in authorized navigation                                                                 | Default; neutral fallback links only to public home |
| `components/app-navigation.tsx`                                             | projects, partner-organizations, organization, user-settings                                                         | Default; permission-dependent items only after gate |
| `components/auth-form.tsx`                                                  | login/register with optional next URL; home                                                                          | Default; retain auth exception                      |
| `features/projects/components/project-list.tsx`                             | Project detail with returnTo; Hosting Participant report                                                             | Default; URL data streams                           |
| `features/projects/components/assigned-project-list.tsx`                    | Project detail; Hosting Participant report                                                                           | Default; URL data streams                           |
| `features/projects/components/project-workspace.tsx`                        | Project-list return destination; Hosting report; review queue; partner-organizations; Partnership participants/Claim | Default; URL data streams                           |
| `features/projects/components/claim-review-queue.tsx`                       | Claim review detail                                                                                                  | Default; request-bound Claim data                   |
| `features/projects/components/claim-review.tsx`                             | Proof Document API downloads; review queue                                                                           | Default; downloads authorize per request            |
| `features/projects/components/participant-coordination.tsx`                 | Partnership Participant detail                                                                                       | Default; request-bound Participant data             |
| `features/projects/components/participant-details.tsx`                      | Partnership Participant list                                                                                         | Default; request-bound Participant data             |
| `features/projects/components/project-data-error-boundary.tsx`              | login                                                                                                                | Default; retain redirect/retry semantics            |
| `app/(protected)/partnerships/[id]/{claim,participants}/page.tsx`           | projects                                                                                                             | Default shell                                       |
| `app/(protected)/partnerships/[id]/participants/[participationId]/page.tsx` | projects                                                                                                             | Default shell                                       |
| `app/(protected)/projects/[id]/participants/page.tsx`                       | projects                                                                                                             | Default shell                                       |

Deliberately **no per-link `prefetch={true}`** is added for Claim or Participant
URL data (or other private detail reads). IDs/searchParams resolve inside the
existing section boundaries; financial and Journey data stay request-bound.
There is no legacy full-prefetch UI to preserve. This avoids a server invocation
per visible entity link without inventing a private data cache lifetime.

### Rejected cache candidates

- Session/Memberships and permission-dependent navigation: reject private cache;
  revocation and active Organization recovery must use request-time authority,
  not stale prefetched permissions.
- Organization/team, Project relationship, and Partnership reads: reject private
  cache; tenant/permission changes must not expose stale authorized content.
- Claim workspace/review, payouts, allocations, and Proof Documents: reject
  private or shared cache adoption; financial freshness and authorization remain
  at the existing procedure boundary.
- Participant identity, onboarding eligibility, agreements, and Journey data:
  reject private cache; sensitive data and state-machine order stay request-bound.

Existing TanStack Query hydration/staleTime is unchanged; this is not a financial
or Journey-data caching migration.

### Verification and deferred coverage

`layout.test.tsx` renders the real layout through a server stream with a deferred
session, asserting neutral chrome/Skeletons before private children/navigation,
then personalized content. Gate tests preserve creation/selection recovery,
staff/Participant switcher rules, request boundary order, and session redirect
propagation. Existing page stream and hydration tests remain in place.

Playwright E2E execution is excluded from this adoption. A future separately
approved test task should use version-matched `@next/playwright` `instant()`
coverage for direct `/projects` entry, public-to-protected navigation, sibling
Project/Partnership/Claim/Participant links, and denied/revoked sessions. Assert
neutral shell first on direct entry, section fallbacks on shared-layout
navigation, no unauthorized actions/private data while pending, then content or
redirect/recovery. Production-like automatic Link prefetch testing requires a
test-only build with the testing API enabled; dev alone cannot prove production
automatic prefetch. Do not install/configure that harness in this issue.

Runtime verification evidence (#259) and the remaining deferred work are
recorded in the subsections below; passing mocked streams alone is not
browser timing evidence.

### Route opt-ins and exclusions

Adoption is global (`partialPrefetching: true` in `next.config.ts`); no
per-route `prefetch = 'partial'` export was needed because the audit found zero
legacy `prefetch={true}` Links and every protected destination already carries
a static shell with URL data behind Suspense. Adopted via the flag: `/`, all
protected data pages, and `/user-settings`. Excluded from instant validation
via retained `instant = false`: `/login`, `/register`, and the five
onboarding/recipient entry pages inventoried above. No route carries
`prefetch = 'force-disabled'`.

### Redirect correctness

`requireSession()` still redirects server-side inside `ProtectedShell`
(`layout.test.tsx` asserts the redirect propagates without Membership reads),
and the fallback carries no session data or actions. Verified in the running
dev app: signed-out entry to `/projects` lands on `/login` (auth shell, no
protected content); a Membership-free account renders creation recovery. The
accepted neutral-shell flash replaces blocking, not authorization.

### Running-app verification evidence (#259)

Verified 2026-10-11 against Cost Tracker dev (Turbopack) with the in-repo seed
Organization account; `get_compilation_issues` returned no issues and the dev
log showed no instant/URL-data insights for the changed routes. Signed-out
entry `/projects` redirects to `/login` (auth branding paints, no protected
content). Authenticated entry `/projects` renders personalized navigation
(Organization switcher, permission-gated tabs, account menu) plus the hydrated
Project list. Journey 1, Project list to `/projects/[id]`: the workspace
header and data render after client navigation with the shared layout intact.
Acting for the Partner Organization (Organization switcher), the Partner
Project workspace renders the Project Partnership card (Claim readiness,
Hosting Organization, assignment dates) with Coordinate Participants and Open
Claim Workspace entry points.
Journey 2, `/partnerships/[id]/claim`: the static shell (`Claim workspace`
heading plus skeleton) paints first. Acting for the Hosting Organization it
resolves to the permission denial that User must see ("Only the Partner
Organization may edit its Claim") — authorization intact, no Claim data
leaked. Acting for the Partner Organization it streams the full workspace
(submission checklist, editable draft, payout accounts, Participant Journeys,
Travel Cost Entries) — request-bound financial data intact. Journey 3,
`/partnerships/[id]/participants` to Participant detail: the list streams,
then the detail renders participation data. Cold-compile navigations take
roughly 9–25 s in dev; production timing is not established here. Playwright
`instant()` regression coverage remains deferred as stated above.
