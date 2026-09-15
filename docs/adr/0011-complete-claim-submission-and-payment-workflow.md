---
status: accepted
---

# Complete Claim Submission and Payment Workflow

Cost Tracker uses a Claim-owned lifecycle rather than clickdummy Project phases. It validates a complete Claim before submission, calculates the payable amount, and records one full payment through a binary paid flag.

## Decision

- No Project-wide Claim phase gates Partner-side Claim work. A Partner-side Project Coordinator may prepare its Project Partnership's Claim once a Payout Account is selected.
- Submission requires a selected Payout Account, at least one Travel Cost Entry, valid exact Cost Allocations, supporting Proof Documents, and a complete Participant Journey for every covered Project Participation.
- The payable amount is derived from approved allocated costs and the per-Participant funding cap; it is never manually entered by the Partner side.
- A submitted Claim is locked. Only a Hosting-side correction request unlocks Partner-side editing.
- Approval locks the Claim; payment is a separate event.
- The MVP permits one payment only, equal to the approved amount. `paid` is a binary Claim flag.
- An authorized Hosting-side role may correct an erroneously marked paid Claim back to unpaid with a required reason. This records an application correction, not a bank-transfer reversal.
- Claim history is append-only and records every submission, correction, decision, payment, and payment-status correction with actor and time.
- A Project Partnership's selected Payout Account may change only while its Claim is editable. It is locked on submission and becomes editable again only through a correction request; it cannot change after approval.
- Project-wide progress is derived, not manually phased. Project completion is available only when every Project Partnership has a terminal Claim: paid or rejected.

## Consequences

- ADR-0003's Cost Submission Window and manual Project-level Claim phase are superseded.
- The detailed target workflow is maintained in [`apps/cost-tracker/docs/claim-workflow.md`](../../apps/cost-tracker/docs/claim-workflow.md).
- Project-wide progress is a derived readiness view, not a manual workflow state. It can report Claim activity, correction requests, approved unpaid Claims, paid Claims, and rejected Claims without blocking unrelated Project Partnerships.
