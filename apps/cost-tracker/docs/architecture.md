# Cost Tracker architecture

Cost Tracker keeps route composition separate from feature behavior.

## Source layout

```text
src/
├── app/                              # Next.js routes and layouts
├── components/                       # application shell and shared UI
├── features/<feature>/
│   ├── components/                   # feature-owned UI
│   ├── providers/                    # RSC-safe context boundaries, when needed
│   ├── hooks/                        # feature-owned client/query hooks, when needed
│   ├── validation-schemas.ts         # Drizzle-derived Zod schemas
│   ├── types.ts                      # types inferred from schemas or Drizzle
│   └── utils.ts                      # pure feature utilities, when needed
└── lib/                              # application integration seams
```

Create only the subdirectories a feature uses; do not add empty architecture placeholders. Keep route files focused on authorization, server data loading, metadata, and feature composition. Shared application-shell components belong in `src/components/`; behavior used by one feature belongs under that feature.

## Claim ownership

Claim lifecycle, UI components, procedures, limits, and payable calculation live in `src/features/claims`. Participant Journeys belong to `src/features/participations`; Claim-affecting writes still use the one Claim lifecycle policy and lock implementation. Existing oRPC router groups and URLs remain unchanged.

## Persistence seam

Runtime route and view modules consume oRPC interfaces. Feature procedure modules own application database-client access, including authorization, active Organization scoping, persistence, and DTO projection. Integration-test fixtures, Better Auth integration, and schema-derived validation are separate seams. `pnpm run check:cost-tracker-persistence-seam` rejects direct database-client package roots and subpaths, dynamic imports, and local alias or re-export chains in route and view modules; it intentionally permits the separate seams. Run it after changing Cost Tracker routes or views.

## Validation and types

`pnpm --filter @greendex/cost-tracker run lint:check` checks the shared
`.oxlintrc.json` policy over this app's `src`, including UI design-system and
domain/type ownership rules, without fixing files. Tailwind-resolving rules are
separate; run `pnpm run check:tailwind` from the repository root for those checks.

Persisted form schemas start from the owning Drizzle table with `drizzle-zod`, then narrow and refine that schema for the user-editable payload. Infer types from schemas or Drizzle instead of duplicating persistence shapes by hand. Keep schemas usable by both server and client modules unless they intentionally depend on a server-only integration.

## Project read architecture

`/projects` is the canonical Project list. Its Server Component parses the shared nuqs contract, resolves the available Hosted/Partner scope through oRPC, and prefetches exactly one generated list query. The hydrated client view keeps scope, filters, sort, cursor, and page size in shallow URL state; TanStack Query requests each authoritative page and TanStack Table renders that page without client filtering, sorting, or pagination.

`/projects/[id]` accepts only Project identity. `features/projects/procedures/core.ts` derives Hosted, Partner, or inaccessible access from the active Organization, and the detail procedure projects relationship-specific safe data. URL scope is never authorization input.

`/partner-organizations` owns Hosting-side Project Partnership management. Procedures validate Better Auth actions, prove Hosting ownership, and preserve represented-Organization invariants. Existing Organization discovery remains deliberately limited to exact known IDs until a directory disclosure policy is approved.

The pre-release `/dashboard` route is intentionally absent. Authentication, brand, and Organization-recovery destinations use `/projects`.

## Cache Components and request-bound loading

Cost Tracker enables Cache Components and `partialPrefetching: true`. Default
Links prefetch shared App Shells rather than per-link private content. Neither
authenticated reads nor Claim/Participant Journey data adopt `"use cache"` or
`"use cache: private"`; per-session data stays request-bound through oRPC and the
existing request-scoped QueryClient/hydration seam.

The protected layout is synchronous: a neutral brand and Skeleton fallback can
paint before the async protected shell calls `connection()`, resolves the session,
Memberships, active Organization recovery, and permission-dependent navigation.
The fallback contains no private data or staff actions. A brief neutral-shell
flash before a login redirect or Organization recovery is accepted. All gates
remain server-side, and pages/procedures still authorize each request. This
layout no longer exports `instant = false`. Login, registration, invitation,
setup, Participant entry, and protected data routes opt out of instant
validation. This preserves request-time entry handling and full-content page
transitions. The export opts out of validation, not request handling.

Organization-scoped pages check active Membership readiness independently of the
shell; procedures remain authoritative for permissions. Initial data and URL
promises resolve in async server sections. Claim document headers and bodies
resolve together before the transition commits. Permission-dependent actions
remain absent until authorization resolves. Claim grouping, Cost Allocation,
and payout procedures are unchanged.

For changes to these routes, use the installed
[Cache Components adoption skill](../../../.agents/skills/next-cache-components-adoption/SKILL.md)
and [Next dev-loop skill](../../../.agents/skills/next-dev-loop/SKILL.md), plus the
[shadcn skill](../../../.agents/skills/shadcn/SKILL.md) for skeleton composition.
Resolve `next/package.json` from this workspace with `require.resolve`, then read
the matching guides under the single installed `next/dist/docs/`: migrating to
Cache Components, authentication with Cache Components, streaming, `connection`,
and `partialPrefetching`. Do not download another per-app documentation corpus or
run the incremental opt-out codemod over these intentionally adopted routes.

Query `/_next/mcp` on the configured Cost Tracker dev port before edits and after
changes, including `get_routes` and `get_compilation_issues`. Cross-check the live
browser's fallback-to-content transition and hydration with `next-dev-loop`;
a successful build or mocked stream alone does not verify browser behavior. See
the [route audit](prefetch-suspense-audit.md) for coverage and remaining checks.

## Navigation chrome

The protected layout renders `BreadcrumbNav` in the shell. Crumb labels stay
static: no entity names or payload strings enter the trail.

Hrefs are typed from Next's generated routes ([`src/app/routes.ts`](../src/app/routes.ts)).
Dynamic Project and Project Partnership targets come from the builders in
[`src/app/paths.ts`](../src/app/paths.ts), which own the one `AppHref` cast so
callers never interpolate an id into a template literal.

## Anonymous gate

[`src/proxy.ts`](../src/proxy.ts) redirects a request that carries no Better Auth
session cookie away from a protected path before the App Shell renders. It is an
optimistic check only: it reads cookie presence, never the database, and keeps
the public route segments in one explicit list so a new protected route is gated
by default. `ProtectedShell` keeps the authoritative `getSession()` check, which
also covers an expired session whose cookie is still present.

## Notification declarations

`src/lib/orpc/notification-declarations.ts` is the complete inventory of router entries: every action maps to a typed notification intent (event plus recipient resolver) or to explicit `null` when it emits nothing. `router.ts` attaches the inventory through `attachNotificationDeclarations`, and the mapped `NotificationDeclarationTree<typeof router>` type fails type checking when an entry is missing, renamed, or extra. The runtime enforcement test walks the exported router and requires a declaration on every procedure object. `claims.markPaid` is the only v1 emitter (`claim.paid` v1); its recipient resolver runs inside the payment transaction. After commit, the handler emits best-effort to the separate [Realtime service](../../realtime/README.md), which validates the Better Auth session on handshake, joins personal user rooms only, and broadcasts validated envelopes. A failed emit leaves the payment and its persisted inbox rows intact.

The shell bell reads the unread query on mount and window focus, invalidates it on every live push and socket reconnect, and marks a clicked notification read before opening its Claim. The live stream shows a toast through the existing toast manager. `NEXT_PUBLIC_REALTIME_URL` is passed from the protected shell to the client bell; when it is absent the bell still reads persisted unread rows, only live delivery is disabled.

## oRPC error presentation

Initial Cost Tracker oRPC failures stay in the retryable error boundary. Refresh failures retain cached data and produce a toast. Identical refresh failures—same oRPC status and code, or the same local error type and message—share one toast within a two-second interval; distinct failures remain separately visible.

## Current feature ownership

| Feature                  | Ownership                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `authentication`         | Login, sessions, and general account onboarding                                                      |
| `organizations`          | Organization settings, Memberships, colleague invitations, and Organization switching                |
| `projects`               | Project listing, creation, details, completion, and Hosting scope                                    |
| `partnerships`           | Project Partnership assignments, setup links, coordinator administration, and Partnership scope      |
| `participations`         | Participant management, reports, duplicate review, and Participant Journeys                          |
| `participant-onboarding` | Participant Invitations, Registration Links, required information, Agreement acceptance, and joining |
| `claims`                 | Claim lifecycle, costs, allocations, documents, payout workflow, submission, review, and payment     |
| `notifications`          | Persistent notification inbox, event catalog use, unread listing, and read state                     |
| `user-settings`          | Personal preferences                                                                                 |
| `breadcrumbs`            | Per-route breadcrumb trails in the App Shell header, their slot boundary, and their labels           |

Within each feature, `components/` owns UI and `procedures/` owns server operations. The nested Participant Onboarding workflow follows the same convention. Tests stay beside their implementation. Pure policies, calculations, schemas, and inferred types live with their owner rather than being presented as procedures.

Routes compose these features without changing URL structure. Cross-feature imports are explicit through `@/`; do not add forwarding barrels or duplicate policies to make features artificially independent. Shared query error recovery, entity selection, skeleton building blocks, top navigation and sidebar chrome, and provider mechanics live in `src/components/`. Each feature owns its own loading-state composition. Infrastructure stays in `src/lib/`.

Folder ownership does not alter domain relationships. Project Participation belongs to the Project, Agreement acceptance belongs to the User, and Payout Accounts belong to an Organization with selection by Project Partnership. The existing combined payout workflow remains within Claims.

See [Cost Tracker Projects](projects/README.md) and [User settings](user-settings.md) for behavior and integration details.
