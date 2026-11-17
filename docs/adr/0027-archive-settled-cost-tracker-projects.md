---
status: accepted
supersedes:
  - "0011, Project-completion action and its availability rule only"
---

# Archive Settled Cost Tracker Projects Instead of Completing the Project

Cost Tracker closes the administration of Claims, not the real-world Project. Its explicit **Archive** action confirms that every Project Partnership's Claim is settled (`paid` or `rejected`) and makes Project-scoped Cost Tracker work read-only. A missing Claim blocks archive; a Project with no Project Partnerships may be archived because there is nothing to settle.

## Decision

- Keep ADR-0011's Claim-owned lifecycle, separate approval/payment, derived readiness and absence of manual Project-wide Claim phases. Replace its separate Project-completion action with Cost Tracker archive/reopen. There is no additional review-finished event or Claim-close action.
- Cost Tracker owns its archive state independently of Calculator archiving. Shared Project identity does not imply a shared administrative workflow. Archive/unarchive in either application must not change the other's lifecycle state.
- Hosting Organization Owners, Organization Admins and explicitly assigned Hosting-side Project Coordinators may archive. Reopening is a separate declared Cost Tracker Project `reopen` permission, granted by default only to the Hosting Organization's Owners and Admins, not Project Coordinators or Partner-side roles.
- Reopening requires a reason. Archive/reopen retain responsible User and time across cycles; neither changes Claim statuses. Further authorized corrections follow the existing Claim rules after reopening.
- Archive is explicit, confirmed and reversible, never automatic or time-based. Authorized readers retain access. There is no separate `completed` endpoint of this lifecycle competing with archive.
- Preserve ADR-0001's zero-to-many Project Partnerships and at most one Claim per Project Partnership. The Clickdummy explicitly supports multiple Partner Organizations; the contrary restriction in #337 is withdrawn, not implemented.

## Considered alternatives

- **Only record completion:** rejected because later Claim work can invalidate the supposed final state without reopening.
- **Reuse the shared archive flag:** rejected because Calculator archiving neither proves Claim settlement nor expresses permission to reopen the Cost Tracker workflow.
- **Keep review-end and Project-completion ceremonies:** rejected because Claim decisions, recorded payment and one explicit archive confirmation already express the meaningful facts.
- **Define “recently closed” submission windows:** rejected because age is not settlement readiness; a hidden duration loses follow-up work. Explicit archive and derived settlement filters replace that request.

## Consequences

This decision is an approved target, **not yet implemented** by the specification commit. At baseline `3863c601`, `projects.complete` only writes `completed_at`/`completed_by_user_id`, Claim writes check the shared archive flag, and Cost Tracker lists exclude shared-archived Projects. Existing completion records must not be blindly treated as valid archive decisions: subsequent Claim work was possible.

The legacy Cost Submission Window is removed, not replaced by another submission phase. Claim preparation is named `in_preparation` (“In Vorbereitung” / “In preparation”); correction-requested Claims remain a separate state. UI and list behavior belong in the [Cost Tracker behavior](../../apps/cost-tracker/docs/domain-behavior.md) and [Project reference](../../apps/cost-tracker/docs/projects/README.md). The authoritative implementation specification is [master #414](https://github.com/henningsieh/greendex-calculator/issues/414), with five subissues in one delivery package: [archive/reopen #416](https://github.com/henningsieh/greendex-calculator/issues/416), [window removal #417](https://github.com/henningsieh/greendex-calculator/issues/417), [Claim workflow/naming #418](https://github.com/henningsieh/greendex-calculator/issues/418), [filters/table #332](https://github.com/henningsieh/greendex-calculator/issues/332), and [UI cookies #415](https://github.com/henningsieh/greendex-calculator/issues/415).

The cardinality evidence is preserved in the [completed source review](../../apps/cost-tracker/docs/archive/project-partner-cardinality-review.md). ADR-0001 remains accepted; this decision does not restrict its relationships or alter Calculator's archive procedure.
