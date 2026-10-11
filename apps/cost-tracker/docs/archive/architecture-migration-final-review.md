# Final Cost Tracker migration review

**Issue:** [#121](https://github.com/henningsieh/greendex-calculator/issues/121)
**Reviewed range:** `4903da2..1476a79`
**Canonical source review:** [Architecture review after the migration fix](architecture-review-after-migration-fix.md)

## Result

The six Phase 6–8 delivery areas are accepted. The independent Standards and Spec axes found no new acceptance blocker in the reviewed range. Historical findings that are intentionally not part of these six fixes have a live, focused follow-up issue below.

This review does not reopen accepted Phases 1–5 or deferred work without new evidence.

## Independent review axes

### Standards

The reviewed implementation keeps database access in feature procedures, uses typed oRPC failures, preserves the two server-side oRPC initialization paths, and uses server-authoritative Table modes. The persistence-seam check now follows direct, subpath, alias, re-export, and dynamic database-client imports while retaining its documented exceptions.

No new standards blocker was found for the six delivery areas. The source review's remaining accessibility, auth-feedback, type-safety, workspace-catalog, and duplication findings remain explicitly deferred below.

### Spec

`SPEC-01`, `NAV-01`, `ERROR-01`, `ARCH-01`, `ARCH-02`, and `TEST-01` have matching production seams and red-capable test evidence. The browser suite uses the built Cost Tracker application, its real nuqs adapter, and `/api/rpc`; the focused tests cover direct oRPC contracts, SSR initialization, hydration, mutation invalidation, and the persistence guard.

No scope creep or missing requirement was found in the accepted six areas. The migration-history, atomic tenant-scoping, and Drizzle-derived persisted-form concerns are deliberately deferred to focused issues rather than being represented as fixed.

## Delivery evidence

| Area       | Reviewed production seam                                                                                                                                                                                       | Test evidence                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SPEC-01`  | `collection-state.ts` resolves an unavailable Partner request before querying, clears its cursor, and `project-collection.tsx` replaces the URL and announces the fallback.                                    | `collection-state.test.ts`, `project-collection.nuqs.test.tsx`, and the production browser collection flow.                                                                                                                                             |
| `NAV-01`   | `overview-procedures.ts` and `project-overview-cursor.server.ts` issue directional opaque cursors; `project-collection.tsx` asks the Table to move pages; the Project workspace validates and uses `returnTo`. | `overview-procedures.integration.test.ts`, `project-collection.test.tsx`, `project-workspace.test.tsx`, and the browser reload/Back/Forward/return flow.                                                                                                |
| `ERROR-01` | `projects/page.tsx` no longer fabricates scope availability; Cost Tracker error presentation uses `error-message.ts`, the query provider, and `project-data-error-boundary.tsx`.                               | `project-data-error-boundary.test.tsx`, route tests, and the error-message coverage in the reviewed range.                                                                                                                                              |
| `ARCH-01`  | `check-cost-tracker-persistence-seam.ts` traces runtime imports and rejects persistence access from route and view modules.                                                                                    | `check-cost-tracker-persistence-seam.test.ts` exercises roots, subpaths, aliases, re-exports, dynamic imports, and the permitted seams.                                                                                                                 |
| `ARCH-02`  | `project-collection.tsx` owns Table filtering, sorting, and cursor-page state, uses stable Project IDs, and enables manual server modes only.                                                                  | `project-collection.test.tsx` and `project-collection.nuqs.test.tsx` cover controlled state, URL changes, and row identity.                                                                                                                             |
| `TEST-01`  | `instrumentation.ts`, root `app/layout.tsx`, hydration, Project collection, Project Partnership mutation, and `/api/rpc` are exercised through production-facing seams.                                        | `initialization-entrypoints.test.ts`, `hydration.test.tsx`, `project-partnership-manager.test.tsx`, direct oRPC integration tests, and `src/__tests__/e2e/projects.spec.ts`. The new regression assertions document the break that would make them red. |

## Required acceptance evidence

### Tenant isolation and permissions

Current hosted/Partner reads and Project-detail relationship resolution bind the active Organization in their authorization query. Direct oRPC integration tests cover hosted, Partner, inaccessible, and permission-specific results. The historical atomic check-then-act concern is not claimed as fixed: it is tracked by [#130](https://github.com/henningsieh/greendex-calculator/issues/130).

### Server-side oRPC initialization

`instrumentation.ts` initializes the direct client in the Node runtime, and the root layout side-effect-imports it before local SSR consumers. `initialization-entrypoints.test.ts` exercises both entrypoints and fails if the browser transport is constructed for SSR.

### Persistence enforcement

The executable guard and adversarial fixtures confirm that routes/views consume oRPC rather than a database client. Feature procedures, Better Auth integration, schema imports, and integration fixtures remain allowed.

### Browser navigation

The Cost Tracker Playwright flow verifies a hydrated `/projects` page, real RPC-backed URL state, reload, Project return, browser Back/Forward, Project Partnership refresh, protected routes, and the intentionally absent `/dashboard` route.

### Tests, types, lint, format, and build

The commands below were run from the repository root after this review artifact was added. Their current result is recorded in the issue-close comment for [#121](https://github.com/henningsieh/greendex-calculator/issues/121):

```sh
pnpm run format
pnpm run lint
pnpm run type-check
pnpm run test:run
pnpm run build
pnpm run check:agent-instructions
pnpm --filter @greendex/cost-tracker test:e2e
```

## Disposition of the canonical 13 findings

Every row uses exactly one disposition. “Fixed here” means the reviewed range contains a production change and red-capable coverage; “Deferred” names a live issue.

| #   | Disposition    | Evidence or reason                                                                                                                                                          |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Deferred**   | [#129](https://github.com/henningsieh/greendex-calculator/issues/129) will restore append-only migration history for already-migrated databases.                            |
| 2   | **Deferred**   | [#130](https://github.com/henningsieh/greendex-calculator/issues/130) will make Partnership authorization and dependent persistence atomic.                                 |
| 3   | **Fixed here** | Runtime relationship persistence moved to `project-relationship-procedure.ts`; the executable persistence-seam guard and its adversarial tests prevent a route/view bypass. |
| 4   | **Fixed here** | `projects/page.tsx` retains failed availability as an error; route and error-boundary tests cover the honest failure path.                                                  |
| 5   | **Fixed here** | Cost Tracker-wide oRPC failure presentation reports safe failure states through the query/error boundary seam and its regression tests.                                     |
| 6   | **Deferred**   | [#122](https://github.com/henningsieh/greendex-calculator/issues/122) owns accessible names for the remaining Select controls.                                              |
| 7   | **Fixed here** | `project-collection.tsx` configures `getRowId: (row) => row.id`; feature tests cover stable Project identity.                                                               |
| 8   | **Deferred**   | [#124](https://github.com/henningsieh/greendex-calculator/issues/124) owns reuse of Project query boundary types.                                                           |
| 9   | **Deferred**   | [#124](https://github.com/henningsieh/greendex-calculator/issues/124) owns removal of unsafe Project-boundary coercions.                                                    |
| 10  | **Deferred**   | [#131](https://github.com/henningsieh/greendex-calculator/issues/131) will derive persisted Cost Tracker form schemas from Drizzle tables.                                  |
| 11  | **Deferred**   | [#123](https://github.com/henningsieh/greendex-calculator/issues/123) owns direct Better Auth failure feedback.                                                             |
| 12  | **Deferred**   | [#125](https://github.com/henningsieh/greendex-calculator/issues/125) owns workspace-catalog dependency cleanup.                                                            |
| 13  | **Deferred**   | [#126](https://github.com/henningsieh/greendex-calculator/issues/126) owns duplicated Project policy, pagination, and sorting logic.                                        |

## Phase 0 qualification

The missing Phase 0 coordination record is historical evidence, not a missing production-code change. It cannot be recreated honestly after the work occurred and is not a runtime or security defect. See [Phase 0 – kurze Erklärung](phase-0-erklaerung.md) for the short German explanation.
