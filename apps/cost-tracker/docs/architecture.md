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

## Persistence seam

Runtime route and view modules consume oRPC interfaces. Feature procedure modules own application database-client access, including authorization, active Organization scoping, persistence, and DTO projection. Integration-test fixtures, Better Auth integration, and schema-derived validation are separate seams. `pnpm run check:cost-tracker-persistence-seam` rejects direct database-client package roots and subpaths, dynamic imports, and local alias or re-export chains in route and view modules; it intentionally permits the separate seams. Run it after changing Cost Tracker routes or views.

## Validation and types

Persisted form schemas start from the owning Drizzle table with `drizzle-zod`, then narrow and refine that schema for the user-editable payload. Infer types from schemas or Drizzle instead of duplicating persistence shapes by hand. Keep schemas usable by both server and client modules unless they intentionally depend on a server-only integration.

## Project read architecture

`/projects` is the canonical Project list. Its Server Component parses the shared nuqs contract, resolves the available Hosted/Partner scope through oRPC, and prefetches exactly one generated list query. The hydrated client view keeps scope, filters, sort, cursor, and page size in shallow URL state; TanStack Query requests each authoritative page and TanStack Table renders that page without client filtering, sorting, or pagination.

`/projects/[id]` accepts only Project identity. `project-relationship-procedure.ts` derives Hosted, Partner, or inaccessible access from the active Organization, and the detail procedure projects relationship-specific safe data. URL scope is never authorization input.

`/partner-organizations` owns Hosting-side Project Partnership management. Procedures validate Better Auth actions, prove Hosting ownership, and preserve represented-Organization invariants. Existing Organization discovery remains deliberately limited to exact known IDs until a directory disclosure policy is approved.

The pre-release `/dashboard` route is intentionally absent. Authentication, brand, and Organization-recovery destinations use `/projects`.

## Cache Components and request-bound loading

Cost Tracker enables Cache Components while retaining the previous link-prefetch
behavior (`partialPrefetching: false`). This intentionally differs from
Calculator's separate Partial Prefetching adoption. Neither authenticated reads
nor Claim data use `"use cache"`.

The protected layout follows Calculator's deliberate blocking gate: `instant =
false` preserves authentication and active Organization recovery before shell
paint, and `connection()` waits for a real request before session and Membership
reads. Page Membership and permission checks still precede their shells. The
seven sign-in, registration, invitation, and onboarding pages outside that layout
also keep documented `instant = false` gates; their existing headers, params, and
searchParams already make them request-bound. This export disables instant
navigation validation, not authentication or request handling.

After the gate, initial data and URL promises resolve in async children behind
inner Suspense boundaries. Feature-owned skeletons match Claim document bands,
responsive decision/summary columns, Participant cards, and Partnership lists.
The same section skeletons are composed into route-level `loading.tsx` fallbacks;
only navigation fallbacks add a header placeholder. Permission-dependent actions
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

## oRPC error presentation

Initial Cost Tracker oRPC failures stay in the retryable error boundary. Refresh failures retain cached data and produce a toast. Identical refresh failures—same oRPC status and code, or the same local error type and message—share one toast within a two-second interval; distinct failures remain separately visible.

## Current feature ownership

Project list state, relationship policy, reads, Project Partnership mutations, and views belong to `src/features/projects/`. User appearance and account-name behavior belong to `src/features/user-settings/`. Protected routes compose those features; shared navigation and provider mechanics remain in `src/components/`.

See [Cost Tracker Projects](projects/README.md) and [User settings](user-settings.md) for behavior and integration details.
