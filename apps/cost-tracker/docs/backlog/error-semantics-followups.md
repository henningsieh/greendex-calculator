# Error semantics follow-ups

Wave 1 checklist. Fix code, safe message and stable reason together; update producer/consumer tests in the same commit and close only after green validation.

- [x] **projects/get non-member auth seam:** Better Auth's non-member 401 previously escaped and became oRPC 500. `src/lib/orpc/middleware.ts:31–44` now normalizes it to 403 + `ORGANIZATION_MEMBERSHIP_REQUIRED`. The shared base protects direct SSR; the RPC interceptor provides a secondary fallback. Covered by `src/lib/orpc/client.server.test.ts`, `src/app/api/rpc/[[...rest]]/route.test.ts`, and the adapter matrix. Commit: `8ced7437`.
- [x] **Missing Participant profile:** `src/features/authentication/procedures/list-my-projects.ts:52` now returns 422 + `PARTICIPANT_PROFILE_REQUIRED`, keeping “Complete your Participant profile before accessing Projects.” The dashboard consumes validated code/status/reason; agreement acceptance remains 403. Covered by `participant-onboarding.integration.test.ts` and `components/participant-onboarding.test.tsx` under `src/features/authentication/`. Commit: `552fed42`.
- [x] **Hosting coordination denial copy:** `src/features/projects/procedures/coordination.ts:72` keeps 403 but now says “You need Hosting Organization staff access or an assignment to this Project.” with `HOST_COORDINATION_REQUIRED`, rather than claiming availability. Browser presentation uses locally approved copy. Covered by `create.integration.test.ts`, `setup-links.integration.test.ts` in that procedure directory and `src/lib/orpc/error-message.test.ts`. Commit: `80c09022`.

Validation: 14 focused suites / 115 tests passed; Cost Tracker type-check and repository format/lint passed (existing lint warnings remain). Factory tests cover all 16 named methods' exact code/status/message/reason; adapter tests cover authoritative Better Auth reasons, safe status fallbacks, malformed/oversized bodies, forged exceptions and failure cookies.

Deferred to later waves: app-wide throw-site migration; broader 409/503 business-policy conversions; splitting mixed selection/membership/scoped-row predicates; invitation/join/staff adapters; proof-document transport semantics; remaining prose-dependent consumers; field-issue/completion-blocker catalogs; reason-based toast grouping and static guardrails. No native Better Auth transport or authorization grants changed.

## Wave 2 — shared denial fanout

Shared Hosting/Partner guards and issuer scope now separate missing Organization selection (400), missing Membership (403), missing scoped Project/Partnership (404), and missing staff/assignment capability (403). Coordinator appointment requires eligible Partner staff, not merely Membership. Claim locks retain Project → Partnership → Claim order and return 404 when a scoped row disappears. Proof download/upload adapt these shared outcomes without changing upload rules, caps, origin checks, or Claim prerequisites. No unrestricted existence probe or authorization grant was added.

The unpublished-agreement 400 guard and all business-state 409/503 policy refinements remain deferred.

## Wave 2 — Project and Organization entry points

Project lists/search/create/detail/completion, Partnership entry points, setup links, and staff invitations use named errors. Missing selection is 400; missing Membership and known missing capability remain 403; scoped missing Projects, Partnerships, setup links, and staff invitations are 404. Setup redemption distinguishes the wrong recipient from an unverified recipient, and both setup and staff-invitation views select local copy using validated code/status/reason rather than remote English prose.

Staff invitation create/accept/cancel preserve authoritative Better Auth causes; unknown or malformed upstream failures are safe 500, not blanket client-input errors. Guarded Partnership removal rereads only permitted scope: absence is 404, proven references remain 400, unexplained refusal is 500. An unidentified assignment foreign-key failure no longer claims a particular Organization is missing. Completion still names scoped blockers and keeps its existing 400 policy.

Closed, expired, used, duplicate, referenced, and completion states deliberately retain 400 in this wave. A used setup link is described as used, without asserting a different Organization; Partnership invariant copy no longer names a database invariant. Native Better Auth, lock order, idempotency, roles, and upload policy remain unchanged.

Wave 3 deferrals: Participant invitation/join adapters and remaining Claim/Participant producers; full proof transport/upload policy; 409/503 policy refinement; safe field-issue/completion-blocker catalogs; reason-based toast grouping and static guards.

Wave 2 validation: all 22 affected suites are green across final runs (521 tests), including the complete 242-test submission suite, shared-denial fanout, staff Better Auth boundaries, coupled consumers, and HTTP/direct-SSR regressions. Cost Tracker type-check and repository format/lint passed; existing lint warnings remain. The constrained-machine harness uses CLI-only 30-second test/hook limits and one worker; no source timeouts or assertions were relaxed. Browser expectations were synchronized, but E2E was not run.

## Wave 3 — Participant invitation flows

Join, issue/reissue, and invitation/registration-link open controls use named outcomes. Missing links, bridge/native invitation rows, replacement invitations and scoped Partnerships return404; wrong invited accounts remain403. Closed/expired/accepted/duplicate/race states keep400. Reopening copy now describes a non-editable Claim, not only a submitted one; its consumer validates the reason. Join's insert conflict describes an identity conflict without asserting this User already joined. The agreement publication guard stays in shared.ts and keeps400.

Better Auth issue/accept failures preserve authoritative causes and failure cookies. Privileged server `addMember` permission/session/selection/configuration failures are safe500 rather than blaming the Invitee; verification, throttling and upstream unavailability remain actionable. No roles, lock order, idempotency, native auth transport or delivery behavior changed. Focused invitation/adapter/factory/coordination suites: 129 tests passed. Business409/503 refinement remains deferred.
