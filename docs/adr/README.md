# Architecture Decision Records

An ADR records **why** the design has its current shape, and **what was rejected**. An ADR is immutable: a decision that is reversed gets a new ADR that supersedes the old one. Never rewrite an accepted ADR to change its outcome.

Every ADR carries `status:` and an optional `supersedes:` list in its frontmatter.

## When to write one

Write an ADR when a decision is expensive to reverse, or when a later reader would reasonably ask "why is it like this?". Routine choices belong in the code, not here.

Superseding is preferred over editing. If you find an accepted ADR that is now wrong, add a new ADR; do not silently correct the old one.

## Index

| ADR | Title | Status | Supersedes |
| --- | --- | --- | --- |
| [0001](0001-model-project-organizations-and-participation.md) | Model Project Organizations and Project Participation | accepted | |
| [0002](0002-integrate-participants-with-better-auth.md) | Integrate Participants with Better Auth | **superseded** | |
| [0003](0003-model-cost-submissions-and-travel-costs.md) | Model Cost Submissions and Travel Costs | **superseded** | |
| [0004](0004-scope-project-coordination-through-assignments.md) | Scope Project Coordination Through Assignments, Not Separate Host and Partner Roles | accepted | |
| [0005](0005-require-authenticated-participant-onboarding.md) | Require Authenticated Participant Onboarding and an App-Wide Agreement | accepted | 0002, in part |
| [0006](0006-derive-claim-participants-through-cost-allocations.md) | Derive Claim Participants Through Cost Allocations | accepted | 0003 |
| [0007](0007-share-participant-journeys-and-cap-claims-by-funding-rules.md) | Share Participant Journeys and Cap Claims by Configurable Funding Rules | accepted | 0003 |
| [0008](0008-return-claims-for-partner-correction.md) | Return Claims for Partner Correction | accepted | |
| [0009](0009-approve-claims-before-recording-payment.md) | Approve Claims Before Recording Payment | accepted | |
| [0010](0010-reject-and-reopen-claims.md) | Reject and Reopen Claims | accepted | |
| [0011](0011-complete-claim-submission-and-payment-workflow.md) | Complete Claim Submission and Payment Workflow | accepted | |
| [0012](0012-ban-fallback-member-role-in-cost-tracker.md) | Ban Better Auth's fallback role in Cost Tracker | accepted | |

ADR-0003 is superseded by ADR-0006, ADR-0007, and ADR-0011 together. ADR-0002 is superseded in part by ADR-0005.

## Related

- Ubiquitous language: [DOMAIN-GLOSSARY.md](../../DOMAIN-GLOSSARY.md)
- Documentation index: [docs/README.md](../../docs/README.md)
- App contexts: [Calculator](../../apps/calculator/CONTEXT.md) · [Cost Tracker](../../apps/cost-tracker/CONTEXT.md) · [Documentation](../../apps/documentation/CONTEXT.md)