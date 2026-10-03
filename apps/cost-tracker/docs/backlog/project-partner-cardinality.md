# Project/Partner cardinality

Status: **open product decision, not yet a confirmed programme fact.** Low priority: nothing blocks the current code, which already implements the 1..n shape.

## The question

Can one Project have more than one Partner Organization, or is one Partner per Project the real rule?

## Why it is still open

The 1..n premise is inherited from singular language, never demonstrated:

- The clickdummy states Partner Organization only in the singular (CD-01, CD-02, CD-03 in [`clickdummy/requirements-traceability.md`](../clickdummy/requirements-traceability.md)) and never depicts two Partner Organizations on one Project.
- Only the “every Project Partnership has a terminal Claim” completion rule ([`claim-workflow.md:71`](../claim-workflow.md)) and the same-email constraint in [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md) imply 1..n. Neither depicts it. ADR-0001's constraint only has meaning while a second Partner is possible.
- Q16 in [`architecture-review-and-migration-plan.md`](../architecture-review-and-migration-plan.md) builds the Partner filter on this premise, but that document is a historical Phase 8 snapshot whose repository baseline is obsolete; it is not the place to settle the question.
- No real programme dataset has been checked.

## Current implementation

`project_partner_organization` carries only `unique(projectId, organizationId)`, so one Project may have many Partner Organizations and one Partner Organization may serve many Projects. Everything downstream is scoped to the Project Partnership rather than the Project: Payout Account selection, one Claim per Partnership (`claims.partnershipId` is unique), Review Tasks, and participant onboarding links and invitation bridges.

## If one Partner per Project is confirmed

Enforce it with a `unique(projectId)` index on `project_partner_organization`:

- One index, no migration of the entity. Every existing `partnershipId` reference keeps working, because the Project Partnership stays in place as the identifier.
- Every “which of the N?” question disappears from the interface, so the invariant lands in one place instead of across the procedures that consume it.
- Reversible: dropping the index re-opens 1..n. A structural collapse would not be.

Then update [ADR-0001](../../../../docs/adr/0001-model-project-organizations-and-participation.md), whose cross-partner same-email constraint becomes dead, and correct CD-01 to state “exactly one Partner Organization”.

## What not to do

Do not delete the Project Partnership entity. Its `id` is referenced by seven tables — Claim, Payout Account selection, Partner-Organization setup links, participant registration links, participant invitation bridges, partner coordinator assignments, and duplicate review tasks. Deleting the table moves that complexity into every caller instead of removing it.

## Cost asymmetry

Enforcing 1:1 later is one index drop. Unblocking a genuine second Partner after building for 1:1 is the expensive direction, so a confirmed multi-partner programme is the only case that justifies paying that cost up front.
