# Open questions retained by the Phase 0–8 architecture review

Status: **open product and design decisions. None blocks current code.** Migrated out of the archived [architecture review and migration plan](../archive/architecture-review-and-migration-plan.md) so that they are visible instead of buried in a historical file.

The migration work itself is finished. The [final review](../archive/architecture-migration-final-review.md) accepts all six Phase 6–8 delivery areas. These six questions were deliberately deferred, not missed.

## 1. Definition of “recently closed”

What persisted timestamp or event, and what exact duration, defines a recently closed Cost Submission Window?

Until this is answered, the filter is unavailable. The plan also defers the matching persistence, event definition, projection, and sorting.

## 2. Staff roles versus the `participant` role

How should authenticated staff be distinguished from the existing or future `participant` role, when both may hold `project:read`?

This matters most before financial fields are enabled. The plan defers the dedicated cost-reporting permission to the future financial slice.

## 3. Hosted-scope availability and the empty state

How should the route determine Hosted-scope availability, and what should it render when the active Organization has neither hosted nor assigned non-archived Projects?

Q24 of the archived plan defines the scope-selection rule, but it does not define this mechanism or the empty-state detail.

## 4. Partner Organization discovery policy

What Organization-directory discovery policy permits Hosting staff to search and select existing Partner Organizations, without exposing an unintended global Organization directory?

A Partner Organization is selected by reference from one Hosting Organization's hosted Projects. Do not create a directory that reveals other Organizations.

## 5. Production volume and response-time budget

What concrete production dataset and response-time budget govern cursor encoding, the exact global and filtered count strategy, query composition, and final index selection?

The plan justifies a very large production portfolio, but it sets no measured budget. The whole-list browser-processing premise depends on the answer.

## 6. Project/Partner cardinality

Can one Project have more than one Partner Organization, or is one Partner Organization per Project the real rule?

Tracked in full in [project-partner-cardinality.md](project-partner-cardinality.md).

## Related tracked work

- [Q16 Partner filter](../archive/architecture-review-and-migration-plan.md) — the Partner filter design depends on item 6 above.
- [A Project Partnership ended/history lifecycle](../archive/architecture-review-and-migration-plan.md) — deferred to a dedicated ADR and backlog item; referenced Partnerships remain undeletable.
