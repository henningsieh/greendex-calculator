# Cost Tracker Architecture Migration Fix Plan

This document records which findings from the full Phase 0–8 review must be fixed now and which work belongs in later GitHub issues.

The reviewed implementation is commit `4903da2`. The original review used the finding IDs listed below.

## Goal

Fix the six important findings that prevent acceptance of Phases 6–8. Keep the parts that already passed. Finish with a new independent review.

A successful final result may keep one historical note: the missing Phase 0 coordination evidence cannot be recreated after the work has happened. That missing evidence is not a code defect and does not block completion of the new fixes.

## Fix now

### SPEC-01: invalid cursor after automatic tab change

The `/projects` page has two Project collection tabs:

- **Hosted** shows Projects owned by the active Organization.
- **Partner** shows Projects assigned to the active Organization through a Project Partnership.

When a URL requests the Partner tab but that tab is no longer available, the application must:

1. select the Hosted tab;
2. remove the incompatible Partner cursor;
3. update the URL to the effective Hosted state;
4. show a toast that explains the automatic change.

Use the shadcn Base UI Toast component documented at <https://ui.shadcn.com/docs/components/base/toast.md>.

### NAV-01: real Previous navigation and Project return link

Project collection procedures must return both Previous and Next cursors. Both pagination buttons must update the `/projects` URL directly. They must work after Reload and when the user opens a cursor URL directly; Previous must not call `window.history.back()`.

A Project row link must carry a validated local return URL. The Project workspace must show a Back to Projects link that restores the exact collection state, including the selected tab, filters, sort order, page size, and cursor. External and malformed return URLs must not be accepted.

### ERROR-01: global Cost Tracker oRPC error handling

A failed `projects.availableScopes` call must remain an error. The application must never invent Hosted or Partner availability.

Add Cost Tracker-wide handling for failed oRPC requests:

- On an initial load without usable data, show an error page or panel with Retry.
- When a later refresh fails and cached data exists, keep the existing data and show an error toast.
- Handle `401` as an expired or missing session and take the user to Login.
- Handle `403` as a permission error, not as an unreachable server.
- Show the HTTP status code when an HTTP response exists.
- When no HTTP response exists, explain that the server or network is unreachable.
- Show safe text rather than raw internal server errors.
- Show one toast for each failed request. Grouping or deduplicating toasts is later UI work.

This global handling applies only to Cost Tracker oRPC requests. It does not change Calculator or direct Better Auth client requests.

### ARCH-01: persistence rule must be enforced

The executable Cost Tracker persistence check must reject database-client access from every route and view module covered by the documented rule. It must cover database client subpaths, local aliases, re-exports, dynamic imports, and feature view files outside a `components` directory.

Add adversarial test fixtures for every false negative demonstrated by the review. Keep the existing allowed cases for feature procedures, Better Auth integration, schema-only imports, and integration-test fixture management.

### ARCH-02: use TanStack Table v9 as documented

Use official TanStack Table v9 features and current installed APIs.

TanStack Table must control the Project table state. Connect that state to the shareable nuqs URL state and to TanStack Query/oRPC requests. PostgreSQL remains responsible for filtering, sorting, counting, and cursor pagination. The browser must not repeat those operations on one server result page.

The table must use stable Project IDs for row identity. Register only the features needed by this server-driven table.

### TEST-01: prove the production behavior

Tests belong to the fix that needs them. Each important regression test must fail against the reviewed implementation before the production fix is applied.

Use these test surfaces:

- direct oRPC integration tests for Project tab, cursor, filter, aggregate, permission, and Project Partnership contracts;
- browser tests using the real nuqs adapter and RPC route for URL updates, Reload, Back/Forward, Project return links, hydration, refresh behavior, and mutation invalidation;
- entrypoint-level tests for server-side oRPC initialization;
- adversarial executable-check fixtures for the persistence rule;
- feature-level TanStack Table and Project Partnership tests for controlled state, stable Project identity, mutations, and query invalidation.

After all fix tickets are complete, run one final cross-cutting verification ticket and a new independent code review.

## Already handled

`QUALITY-01` was formatting-only work. It was committed separately as `578114b` and is not a fix ticket.

## Separate later GitHub issues

Create separate non-blocking GitHub issues for:

- `A11Y-01`: missing accessible names on Select controls;
- `AUTH-01`: direct Better Auth actions can lose failure feedback or remain pending;
- `STD-01`: duplicated Project query types and unsafe type coercion;
- `STD-02`: shared dependency versions outside the workspace catalog;
- `SMELL-01`: duplicated Project policy, pagination, and sort logic;
- moving Cost Tracker UI-triggered Better Auth commands behind dedicated oRPC procedures;
- optional grouping or deduplication of simultaneous error toasts.

For the future Better Auth/oRPC issue, Cost Tracker UI commands should use oRPC, while Better Auth protocol endpoints such as OAuth callbacks and verification links remain on `/api/auth`.

These later issues do not block completion of the six fixes above.

## Not part of this work

- Rebuilding or redesigning accepted Phases 1–5.
- Changing the Calculator application.
- Cost Submission persistence or UI and the other features already deferred by the migration plan.
- Production-scale query optimization or response-time targets.
- Backward compatibility for unused pre-release Cost Tracker migration versions.
- Recreating historical Phase 0 session evidence.
- Unrelated changes that entered the original 25-commit review range.
- Polishing or grouping error toasts beyond the behavior stated above.

## Final check

The work is complete when:

1. all six important findings have production fixes and red-capable regression tests;
2. every fix ticket passes its focused tests and required checks;
3. the final browser, SSR, persistence, type, test, build, lint, format, and agent-instruction checks pass;
4. a new independent review accepts Phases 6–8;
5. Phase 0 is recorded only as a historical qualification;
6. a short easy-German explanation file is added for an ADHD reader, explaining what the missing Phase 0 evidence means, why it cannot be recreated, and why it is not a code defect.
