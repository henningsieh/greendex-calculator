# Architecture review and migration plan

Full visual report opened at:

/tmp/architecture-review-20260908-121953.html

No repository files were changed.

Current-state assessment

The direct Drizzle access was indeed a standards violation:

- Route modules knew persistence details.
- Tenant scoping was duplicated.
- Projectakanaka+bэлийн typing? no. Let's be precise.
- Project Partnership risked duplicated aggregation logic.
- Tests could bypass the interface used by browser consumers.

However, the other live session has already started correcting this. In the latest snapshot, direct database reads have been removed from:

- apps/cost-tracker/src/app/(protected)/dashboard/page.tsx
- apps/cost-tracker/src/app/(protected)/projects/page.tsx
- apps/cost-tracker/src/app/(protected)/partner-organizations/page.tsx

Runtime Drizzle access is now concentrated in:

- apps/cost-tracker/src/features/projects/procedures.ts
- apps/cost-tracker/src/lib/auth.ts — legitimate Better Auth integration

Database use in integration tests is also legitimate fixture management.

The migration is therefore in progress, not yet a new task to implement independently.

────────────────────────────────────────────────────────────────────────────────

Target architecture

```text
  Route module
    ├── metadata
    ├── authentication/redirect composition
    ├── oRPC query prefetch
    └── hydration + feature view module
             │
             ▼
  Feature view module
    └── useSuspenseQuery/useSuspenseQueries
             │
             ▼
  Generated oRPC query interface
             │
             ▼
  Cost Tracker router
             │
             ▼
  Feature procedure
    ├── input/output validation
    ├── authentication
    ├── permission checks
    ├── active Organization scoping
    ├── Drizzle implementation
    └── explicit DTO projection
```

This gives the Project read module depth:

- Interface: typed Project and Partner Organization queries.
- Implementation: authorization, tenant constraints, persistence, aggregation, sorting, and DTO validation.
- Seam: oRPC procedure registration.
- Adapters: direct in-process server client and browser RPC transport.
- Leverage: the same behavior supports dashboard, Project list, and Partner Organization list.
- Locality: persistence and authorization bugs remain in the feature procedure module.

The deletion test passes: deleting this module would spread persistence, tenant scoping, and aggregation back across every route.

────────────────────────────────────────────────────────────────────────────────

Migration plan

Phase 0 — Reconcile the live session

Before making further changes:

1.  Let the other session finish.
2.  Capture its complete worktree diff.
3.  Review rather than recreate its files.
4.  Avoid overlapping edits to the currently untracked oRPC/query files.
5.  Establish one stable snapshot before running verification.

This is essential because the files changed while this review was running.

Phase 1 — Finalize the oRPC foundation

Review and retain:

- src/lib/orpc/context.ts
- src/lib/orpc/middleware.ts
- src/lib/orpc/router.ts
- src/lib/orpc/client.server.ts
- src/lib/orpc/orpc.ts
- src/app/api/rpc/[[...rest]]/route.ts
- src/instrumentation.ts

Acceptance criteria:

- The router registers every Cost Tracker procedure.
- The RPC Route Handler uses the same router.
- The direct server adapter uses request-specific headers().
- The browser adapter targets /api/rpc.
- instrumentation.ts and app/layout.tsx both preserve server-client initialization order.
- Typed oRPC errors survive the entire call path.
- Server rendering never falls back to the browser RPC adapter.

Phase 2 — Finalize the Project read module

Keep Drizzle implementation inside:

apps/cost-tracker/src/features/projects/procedures.ts

For every read:

1.  Authenticate through shared oRPC middleware.
2.  Require the relevant Cost Tracker permissions.
3.  Require an active Organization.
4.  Constrain every Project query by activeOrganizationId.
5.  Exclude archived Projects where the screen promises active Projects.
6.  Select only fields required by the consumer.
7.  Return explicit DTOs validated by Zod.
8.  Never expose:
    - organizationId
    - responsibleUserId
    - internal relationship rows
    - Organization slugs unless explicitly required

The Partner Organization read must continue deriving organizations only through Project Partnerships attached to active Projects belonging to the active Hosting Organization.

Phase 3 — Complete Query infrastructure

Review and retain:

- src/lib/serializer.ts
- src/lib/tanstack-react-query/client.ts
- src/lib/tanstack-react-query/hydration.tsx
- src/components/query-provider.tsx

Acceptance criteria:

- One QueryClient exists per server request.
- One QueryClient persists for the browser provider lifecycle.
- Server and browser use matching serialization.
- Pending queries can be dehydrated.
- Positive staleTime prevents immediate post-hydration refetching.
- Prefetch and consumer use exactly the same generated query options.
- Query keys are never reconstructed manually.

Do not introduce a generic prefetch helper merely to hide three lines. That would be a shallow module: deleting it would remove complexity rather than concentrate it.

Phase 4 — Finish route migration

The three route modules should contain only:

- metadata;
- route-level authentication where required;
- query prefetching;
- hydration;
- feature view composition.

Required query ownership:

┌───────────────────────┬─────────────────────────────────────────────────┐
│ Route │ Prefetch │
├───────────────────────┼─────────────────────────────────────────────────┤
│ Dashboard │ Projects and Partner Organizations concurrently │
├───────────────────────┼─────────────────────────────────────────────────┤
│ Projects │ Projects │
├───────────────────────┼─────────────────────────────────────────────────┤
│ Partner Organizations │ Partner Organizations │
└───────────────────────┴─────────────────────────────────────────────────┘

No route or view module may import the db client.

The dashboard should keep independent prefetches inside Promise.all. Its view should consume them with useSuspenseQueries to avoid a waterfall.

Phase 5 — Loading and failure behavior

The live session has added route loading.tsx modules and accessible skeletons. Complete the state model with:

- meaningful Project, Partner Organization, and dashboard skeletons;
- route- or feature-local failure presentation;
- user-safe error messages;
- retry behavior where recovery is possible;
- preservation of typed UNAUTHORIZED and FORBIDDEN behavior;
- correct navigation or sign-in handling for authentication failures.

Current gap: Cost Tracker has loading modules but no corresponding error.tsx modules. A failed suspense query currently escapes to generic Next.js failure handling.

Phase 6 — Test through the production interface

### Procedure integration tests

Verify:

- active-Organization Project isolation;
- foreign Organization Projects never appear;
- archived Projects never appear;
- Partner Organizations are reached only through valid Project Partnerships;
- unauthenticated calls return UNAUTHORIZED;
- missing active Organization returns FORBIDDEN;
- missing permissions return FORBIDDEN;
- DTOs omit internal persistence fields;
- sorting and aggregation are deterministic.

### Query/view tests

Verify:

- populated lists;
- empty states;
- dashboard counts;
- upcoming Project limit/order;
- singular/plural labels;
- suspense loading presentation;
- query failure presentation.

Mocks should model the generated oRPC query interface, not Drizzle results.

### SSR and transport regression test

Add Cost Tracker coverage equivalent to Calculator’s critical SSR test:

- direct server adapter initializes before orpc.ts;
- server prefetch executes in-process;
- request headers remain request-specific;
- hydrated pages do not immediately refetch;
- browser navigation can use /api/rpc;
- all three routes render through the router.

Phase 7 — Guard the persistence seam

The repository instructions currently name Calculator paths almost exclusively. Extend them to Cost Tracker:

- docs/agents/instructions/architecture.md
- docs/agents/instructions/code-standards.md
- docs/agents/instructions/orpc.md
- docs/agents/instructions/tanstack-query.md
- apps/cost-tracker/docs/architecture.md

Codify this rule:

│ Application runtime database access belongs in owning feature procedures. Route and view modules consume oRPC interfaces.

Allowed exceptions:

- persistence fixture setup and cleanup in integration tests;
- Better Auth database integration;
- schema imports used to derive validation types.

Add an executable architecture check that rejects @greendex/database client imports from Cost Tracker route and view modules. This supplies leverage across every future feature
and makes the seam AI-navigable.

Phase 8 — Production-scale Project collection and workspace shell

Status: justified by the accepted premise that the application must support a very large production portfolio. This section supersedes the former optional dashboard projection. Later decisions in the binding log supersede earlier terminology where noted.

Phase 8 outcome

- `/projects` is the canonical Project collection for this release.
- `/projects/[id]` is the canonical Project workspace and derives Hosted versus Partner access from the active Organization's actual Project relationship.
- `/partner-organizations` becomes the Hosting Organization's Project Partnership management surface.
- The current pre-launch `/dashboard` route is removed without a compatibility redirect. The path is reserved for a future, separately designed stats-first page.
- Project collection reads become bounded, server-authoritative oRPC projections instead of complete in-browser lists.
- The initial Project workspace is a truthful read shell. Cost Submission persistence and write workflows remain outside Phase 8.

Verified repository baseline

- `apps/cost-tracker/src/app/(protected)/dashboard/` exists and currently prefetches complete Project and Partner Organization lists.
- Login, registration, OAuth callbacks, the brand link, no-Organization recovery, navigation, route tests, SSR tests, loading modules, and feature tests currently reference `/dashboard`; removing the route requires updating those references to `/projects`.
- `/projects` currently consumes `projects.list`, which returns every non-archived Project hosted by the active Organization and performs no input filtering or pagination.
- `/partner-organizations` currently consumes `partnerOrganizations.list`, a read-only Hosting-scoped aggregation; it has no management mutations.
- The oRPC router currently registers only `projects.list` and `partnerOrganizations.list`.
- No `/projects/[id]` route, relationship resolver, Hosted/Partner overview procedures, Project Partnership mutations, Cost Tracker TanStack Table, or Cost Tracker nuqs adapter exists.
- Cost Tracker has TanStack Query v5 and oRPC v1, but it does not currently depend on `nuqs` or `@tanstack/react-table`.
- `project.cost_submission_window_open`, Project Partnerships, Project Partnership indexes, Project Participation represented-Organization constraints, and migration `0015_project_partnership_foundation.sql` are implemented.
- Cost Submission, Proof Document, Travel Cost Entry, and Cost Allocation persistence remains documentation-only. No runtime schema, migration, procedure, or mutation implements it.
- No persisted Cost Submission Window opened/closed timestamp, Project-name trigram index, or Project collection ordering/filter index exists.
- Better Auth Organization permissions and typed oRPC `UNAUTHORIZED`/`FORBIDDEN` errors already exist. The current Cost Tracker error module already distinguishes these codes for query presentation.

Binding decision log

1. Q1 — Project overview job — Serve operational and portfolio needs, with one explicitly primary, because different staff audiences need distinct information without losing hierarchy.
2. Q2 — Audience selection — Use role/permission-driven staff experiences; Project Participants are not authenticated dashboard users in the MVP.
3. Q3 — Partner staff visibility — Show only Projects assigned to the active Organization through Project Partnerships.
4. Q4 — Partner Cost Submission visibility — Status only; never money, individual submissions, documents, allocations, or participant identity.
5. Q5 — Trustworthy MVP action state — Use Cost Submission Window state only; do not infer completeness, lateness, quality, or approval.
6. Q6 — Hosting priority — Operational first, with portfolio context secondary.
7. Q7 — Default Hosting collection — Include all non-archived Projects and provide focused filters; “recently closed” remains unavailable until its persistence and duration are defined.
8. Q8 — Table processing — Filtering, sorting, and pagination are server-authoritative because the production-volume premise excludes whole-list browser processing.
9. Q9 — Pagination — Use cursor pagination for stability under concurrent changes.
10. Q10 — Initial filters — Project-name search, Cost Submission Window state, overlapping Project date range, and Partner Organization.
11. Q11 — Date predicate — Include Projects whose interval overlaps the selected range.
12. Q12 — Sorting — Default to open window first, then start date ascending, then Project ID; expose other truthful allowlisted chronological sorts.
13. Q13 — Recency meaning — “Latest operational activity” eventually includes Project and Cost Submission activity, not only `Project.updatedAt`.
14. Q14 — Recency release — Defer Latest operational activity until Cost Submission persistence and event projection exist.
15. Q15 — Name search — Case-insensitive substring matching, debounced, with a three-character minimum and an indexed database implementation.
16. Q16 — Partner filter — Permit multiple Partner Organizations with match-any semantics, scoped to Partners of visible hosted Projects.
17. Q17 — Metric scopes — Show both whole-scope totals and totals for the current filters.
18. Q18 — Hosting target metrics — Project count, open-window count, distinct Partner Organization count, Cost Submission volume, and exact EUR total; Cost-derived metrics are deferred by Q41.
19. Q19 — EUR meaning — Sum each current original Travel Cost Entry exactly once for Cost Submissions belonging to matching Projects; Project dates are not a financial reporting period.
20. Q20 — Initial Hosting financial authorization — Hosting staff with `project:read`; retain a dedicated cost-reporting permission and the missing Cost Submission process as explicit future decisions.
21. Q21 — Dual relationships — Present explicit Hosted and Partner collection scopes rather than combining relationship-specific data.
22. Q22 — Partner target metrics — Assigned Project count, open-window count, and Cost Submission volume; submission volume is deferred by Q41.
23. Q23 — Projection separation — Use two explicit overview procedures because Hosted and Partner authorization and outputs differ.
24. Q24 — Default scope — Hosted when the active Organization has hosted non-archived Projects, otherwise Partner.
25. Q25 — URL ownership — Put scope, filters, sort, cursor, and page size in typed nuqs URL state.
26. Q26 — Client transitions — After SSR prefetch/hydration, use shallow nuqs updates and matching TanStack Query requests.
27. Q27 — Freshness — Keep the 60-second stale time, provide manual refresh/last-updated feedback, and invalidate targeted queries after the actor's own mutations; defer event-driven push.
28. Q28 — Target row metrics — Cost Submission count in both scopes and exact EUR total only in Hosted scope; omit Partner names from Project rows; Cost-derived columns are deferred by Q41.
29. Q29 — Row destination — Navigate each Project row to the new canonical Project workspace.
30. Q30 — Detail authorization — Use one `/projects/[id]` route and derive Hosted or Partner access server-side; URL state never grants privilege.
31. Q31 — Relationship resolver — Put a private server-only resolver in the Projects feature so procedures reuse one policy implementation without a public round trip.
32. Q32 — Partner read authorization — Require Better Auth `projectPartnership:read` and prove that the active Organization is assigned to the requested Project.
33. Q33 — Access errors — Return and transparently present typed oRPC `UNAUTHORIZED` and `FORBIDDEN`; explicitly prefer Forbidden over existence-hiding Not Found for inaccessible Projects.
34. Q34 — Partner detail — Show Project identity/schedule, Hosting Organization identity, current Cost Submission status, and active Partner assignment metadata; submission-derived fields wait for persistence.
35. Q35 — Workspace sequencing — Build the permanent Project workspace shell now and add writes through named dependency-ordered follow-up slices.
36. Q36 — Collection scopes — Retain explicit Hosted and Partner tabs/switcher; this view state is separate from relationship-derived detail authorization.
37. Q37 — Information architecture — Make `/projects` the scoped collection, remove the unused pre-launch `/dashboard`, reserve `/dashboard` for a future stats-first page, and name the projections `projects.hostedOverview` and `projects.partnerOverview`.
38. Q38 — Partner Organizations route — Expand `/partner-organizations` into Project Partnership management rather than a second Project collection.
39. Q39 — Partner management scope — Assign existing Organizations to hosted Projects, inspect assignments, and remove eligible Project Partnerships; defer Organization identity and membership management.
40. Q40 — Partnership removal — Block removal while referenced, as migration 0015 already does for represented Project Participations; defer any ended/history lifecycle to a dedicated ADR and follow-up.
41. Q41 — Initial Hosted workspace — Show Project context, read-only Cost Submission Window state, and assigned Partner Organizations; render no Cost Submission section or placeholder.
42. Q42 — Page size — Default to 25 and allow 25, 50, and 100; changing it resets the cursor.

Target interfaces and ownership

Project collection procedures

- Register separate `projects.hostedOverview` and `projects.partnerOverview` procedures in the Cost Tracker router.
- Both procedures accept validated, allowlisted collection state and return one bounded cursor page plus whole-scope and filtered aggregate values.
- Hosted access requires Better Auth Organization permission and Hosting ownership. Partner access requires `projectPartnership:read` and an actual Project Partnership involving the active Organization.
- Never implement either scope by fetching one complete list and filtering, sorting, paginating, slicing, counting, or aggregating it in a route or view module.
- Keep internal query composition private to the Projects feature. Do not broaden `projects.list` into a conditional all-purpose interface.

Private Project relationship module

- Add a server-only Projects-feature module with a small interface that resolves the active Organization's relationship to one Project as Hosted, Partner, or inaccessible.
- The implementation owns the Project/Project Partnership joins and row-level relationship policy.
- Overview, Project-detail, and Project Partnership procedures reuse it internally; clients do not call it directly.
- Better Auth permissions remain the role-level authorization seam. The relationship resolver is the additional row-level authorization check, not a replacement for `auth.api.hasPermission`.

Canonical Project collection

- Parse the initial nuqs state in the `/projects` Server Component.
- Choose Hosted when it is available and no valid scope is supplied; otherwise choose Partner.
- Prefetch only the selected overview query into the request QueryClient and hydrate its suspense consumer.
- Install the Cost Tracker root `NuqsAdapter` once. Reuse one parser definition between server and client consumers.
- After hydration, table controls update the URL shallowly and the matching generated oRPC query options fetch the new page.
- Every server-owned state value participates in the generated query key; do not copy query rows into a second React state store.
- TanStack Table v9 owns table controls and receives already filtered, sorted, and paginated rows. The procedure remains authoritative for every manual processing stage.

Collection state

- Scope: `hosted` or `partner`.
- Project-name search: normalized case-insensitive substring, minimum three characters, with debounced requests.
- Window filter: all, open, or closed.
- Date range: optional inclusive overlap predicate, `project.startDate <= rangeEnd` and `project.endDate >= rangeStart`.
- Hosted Partner filter: zero or more visible Partner Organization IDs with match-any semantics. It does not apply to Partner scope.
- Sort: allowlisted semantic modes only. Initial modes include the operational default, start-date chronology, and end-date chronology. Latest operational activity is not exposed in Phase 8.
- Cursor: opaque, schema-validated, coupled to the effective scope/filter/sort/page-size state, and based on the selected stable sort values plus Project ID.
- Page size: 25 by default; allow only 25, 50, or 100.
- Changing scope, search, filter, sort, or page size resets the cursor.

Initial collection DTOs and metrics

Hosted rows include only currently persisted Project facts needed by the collection: Project ID, name, dates, location/country where presented, Cost Submission Window state, and any non-sensitive count needed by the initial cards or table. They do not include the list of Partner Organization names.

Partner rows include only Projects assigned to the active Organization and only Partner-safe Project facts. Partner output never serializes Hosting-only financial data or another Partner Organization's relationship data.

Phase 8 summary values are limited to facts backed by the current schema:

- Hosted whole-scope and filtered Project counts;
- Hosted whole-scope and filtered open-window counts;
- Hosted whole-scope and filtered distinct Partner Organization counts;
- Partner whole-scope and filtered assigned-Project counts;
- Partner whole-scope and filtered open-window counts.

Cost Submission volume, per-Project Cost Submission count, and exact EUR totals remain part of the accepted future contract but are not returned or represented by placeholders in Phase 8.

Project workspace shell

- Add `/projects/[id]` as one canonical protected route.
- Its oRPC detail read first applies authentication/permission checks, then uses the private relationship module to select the Hosted-safe or Partner-safe DTO.
- An inaccessible Project returns typed `FORBIDDEN`; an absent session returns `UNAUTHORIZED`; the view maps each code to an explicit user-facing state.
- Hosted shell content: Project context, read-only Cost Submission Window state, and assigned Partner Organizations with navigation to Partner management.
- Partner shell content: Project identity and schedule, Hosting Organization identity, current persisted Cost Submission Window state, and the active Partner assignment timestamps.
- No Cost Submission summary, fake empty Cost Submission section, or disabled write controls appear in this shell.
- Preserve collection scope/filter/sort/cursor state only as navigation context for returning to `/projects`; it never participates in Project authorization.

Project Partnership management

- Convert `/partner-organizations` from a read-only aggregation into a Hosting-only management surface for Project Partnerships.
- Authorized Hosting staff can search/select an existing Organization, assign it to a hosted Project, inspect assignment metadata, and request removal.
- Project Partnership procedures apply Better Auth permissions and separately prove that the active Organization hosts the affected Project.
- Prevent assigning the Hosting Organization as its own Partner and preserve the existing unique Project/Organization assignment constraint.
- Removal must surface the represented-Organization invariant failure when migration 0015 blocks deleting a Partnership referenced by a Project Participation. Do not cascade, orphan, or silently reassign dependent records.
- Phase 8 does not invent an ended/historical Partnership state.

Database and performance work

- Add only indexes justified by the final SQL shape and realistic-volume `EXPLAIN (ANALYZE, BUFFERS)` evidence.
- Add an indexed implementation for normalized case-insensitive substring search; the current database has no `pg_trgm`/trigram support.
- Validate Hosted ownership/window/date/sort access paths and Partner `organization_id`/Project access paths. Existing Project Partnership indexes are a starting point, not proof that the overview query is efficient.
- Keep exact global and filtered counts server-derived; never derive them from one cursor page. Establish query plans and a response budget before declaring production-scale acceptance.
- Do not create Cost Submission tables, activity projections, or financial aggregate storage in Phase 8.

Implementation sequence

1. Reconcile the staged planning artifact without staging unrelated work; preserve completed Phases 0–7.
2. Add Cost Tracker `nuqs` and TanStack Table v9 dependencies, one root nuqs adapter, and shared server/client collection parsers.
3. Add the private active-Organization/Project relationship module and test Hosted, Partner, inaccessible, foreign-tenant, and archived cases.
4. Implement `projects.hostedOverview` and `projects.partnerOverview` with bounded DTOs, stable cursor semantics, current-schema metrics, typed errors, and integration tests.
5. Replace `/projects` with the scoped summary/table collection, SSR prefetch/hydration, shallow URL transitions, manual refresh, and row links.
6. Add `/projects/[id]` and the Hosted/Partner workspace shell with relationship-derived DTO selection and typed error presentation.
7. Implement Project Partnership list/assignment/removal behavior behind feature procedures and convert `/partner-organizations` to the management surface.
8. Remove the pre-launch `/dashboard` route and dashboard-only view/loading modules; update navigation, brand links, login/register/OAuth destinations, no-Organization recovery, SSR coverage, and route/view tests to `/projects`.
9. Add and verify only the database indexes required by observed query plans.
10. Run the Phase 8 verification gate and document deferred follow-up slices without implementing them.

Phase 8 verification

- Procedure integration tests prove Better Auth permission checks and active-Organization row-level scoping independently for Hosted and Partner reads.
- A user with `projectPartnership:read` but no assignment to a requested Project receives `FORBIDDEN` and no Project DTO.
- Partner overview/detail DTO tests prove that financial, submission-record, document, allocation, participant, and unrelated-Partner fields cannot serialize.
- Cursor tests prove deterministic ordering with Project ID tie-breakers, no duplicate/omitted rows for a stable query state, rejection of invalid/mismatched cursors, and page-size limits.
- Filter tests cover three-character substring search, open/closed windows, inclusive date overlap, and Hosted multi-Partner match-any behavior.
- Aggregate tests distinguish whole-scope totals from filtered totals and prove they are independent of page size.
- Route/query tests prove server nuqs parsing, selected-scope-only prefetch, matching generated query options, hydration, shallow client transitions, URL cursor reset rules, manual refresh, and 60-second cache behavior.
- TanStack Table tests cover all enabled sort/filter/cursor interactions using the installed v9 interfaces; no full-list client row model performs server-owned work.
- Project workspace tests cover Hosted, Partner, `UNAUTHORIZED`, and `FORBIDDEN` presentation and prove navigation context does not grant access.
- Project Partnership mutation tests cover Hosting ownership, permission denial, self-partnership, duplicate assignment, successful unreferenced removal, and migration-0015 blocked removal.
- Navigation/auth tests prove `/dashboard` is no longer emitted or used and `/projects` is the post-authentication destination.
- Persistence-seam, SSR-client initialization, format, lint, type-check, focused tests, Cost Tracker build, and agent-instruction checks pass.

Conflicts and qualifications

- Q1–Q6 used “dashboard” as the working name. Q37 explicitly supersedes the route and router naming: those operational/portfolio decisions now apply to `/projects`; `/dashboard` is unbuilt and reserved.
- Q12 requested access to the other proposed sorts, while Q13–Q14 define and defer Latest operational activity. Phase 8 exposes only truthful Project-backed sorts.
- Q7 requested a recently-closed filter, but the current boolean stores neither transition time nor recency. Phase 8 can provide open/closed only.
- Q18, Q22, and Q28 select Cost Submission metrics and row values; Q41 and the verified absent schema defer all of them and prohibit placeholders in Phase 8.
- Q20 says Hosting staff with `project:read` may eventually see financial metrics, but the current `participant` role also has `project:read`. A future Cost Submission slice must not rely on that permission alone until the staff-versus-Participant authorization conflict is resolved.
- Q40's existing trigger blocks Partnership deletion when a Project Participation would become invalid. It cannot yet prove behavior for unimplemented Cost Submission tables; those future foreign-key/lifecycle effects require their own migration verification.
- Q33 deliberately chooses explicit `FORBIDDEN` over hiding inaccessible Project existence. This is an accepted information-disclosure trade-off and must remain explicit in security review.

Open questions retained for implementation or follow-up

1. What persisted timestamp/event and exact duration define “recently closed”? Until answered, the filter is unavailable.
2. How should authenticated staff be distinguished from the existing/future `participant` role when both may hold `project:read`, especially before financial fields are enabled?
3. How should the route determine Hosted-scope availability, and what should it render when the active Organization has neither hosted nor assigned non-archived Projects? Q24 defines the selection rule but not this mechanism/empty-state detail.
4. What Organization-directory discovery policy permits Hosting staff to search/select existing Partner Organizations without exposing an unintended global Organization directory?
5. What concrete production dataset and response-time budget govern cursor encoding, exact global/filtered count strategy, query composition, and final index selection?

Deferred / Not in Phase 8

- Cost Submission, Proof Document, Travel Cost Entry, and Cost Allocation schemas, migrations, transactions, procedures, mutations, and write workflows.
- Cost Submission creation, correction, completeness, lateness, data-quality, approval/rejection, claiming methods/processes, and staff workflow UI.
- Cost Submission summary cards, per-Project submission counts, exact EUR totals, financial reporting periods, and all Cost-derived collection/detail fields.
- Cost summary placeholders or disabled/fake Cost Submission sections in the Project workspace shell.
- Cost Submission Window mutation controls and the combined Cost Submission summary/window-control workflow; the existing boolean is displayed read-only in the shell.
- Full Hosting and Partner Project workspace writes beyond the initial relationship-safe read shell.
- Latest operational activity persistence, event definition, projection, and sorting.
- A dedicated cost-reporting permission; the future financial slice must revisit the current `project:read` decision and Participant-role conflict.
- Event-driven, scope-authorized push invalidation; Phase 8 uses the existing 60-second stale policy, explicit refresh, and mutation invalidation.
- Partner Organization identity creation or editing.
- Partner Organization staff invitation, role, and membership management.
- A Project Partnership ended/history lifecycle, historical visibility, retention semantics, or automatic reassignment. This requires a dedicated ADR and backlog item; referenced Partnerships remain undeletable.
- A recently-closed Cost Submission Window filter until close-event persistence and recency semantics are defined.
- The future stats-first `/dashboard` route.

────────────────────────────────────────────────────────────────────────────────

Final verification gate

After the live implementation stabilizes:

1.  Confirm no direct db client usage in routes or view modules.
2.  Run Cost Tracker procedure integration tests.
3.  Run query/view and loading tests.
4.  Run the new SSR/transport regression test.
5.  Run pnpm run format.
6.  Run pnpm run lint.
7.  Run the relevant type check.
8.  Run pnpm run check:agent-instructions after instruction changes.
9.  Run the Cost Tracker build.
10. Review the final diff for unrelated live-session changes.

Top recommendation

Finish and verify the in-flight oRPC Project read migration first, then immediately add the persistence-seam guard and SSR regression test. Loading/error completion follows in the
same migration before declaring the refactor complete.
