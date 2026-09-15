# Cost Tracker Engineering Documentation

These documents describe behavior owned by the Cost Tracker application.

## Read first

- [Cost Tracking context](../CONTEXT.md)
- [Cost Tracker architecture](architecture.md)
- [Architecture review and migration plan](architecture-review-and-migration-plan.md)
- [Architecture review after the migration fix (13 findings)](architecture-review-after-migration-fix.md)
- [Architecture migration fix plan](architecture-migration-fix-plan.md)
- [Final Cost Tracker migration review](architecture-migration-final-review.md)
- [Phase 0 – kurze Erklärung](phase-0-erklaerung.md)
- [Shared Greendex language](../../../DOMAIN-GLOSSARY.md)
- [Shared Projects documentation](../../../docs/projects/README.md)
- [Cost Tracker Projects](projects/README.md)
- [User settings](user-settings.md)
- [Cost model and schema blueprint](domain-model.md)
- [Claim workflow](claim-workflow.md)
- [Clickdummy use-case traceability](clickdummy/requirements-traceability.md)
- [Garage S3 infrastructure](infrastructure/garage.md)

## Decisions

- [Project Organizations and Project Participation](../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [Participant integration with Better Auth](../../../docs/adr/0002-integrate-participants-with-better-auth.md)
- [Cost Submissions and Travel Costs](../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md) — superseded in part by ADR-0006
- [Derive Claim Participants Through Cost Allocations](../../../docs/adr/0006-derive-claim-participants-through-cost-allocations.md)
- [Share Participant Journeys and Cap Claims by Funding Rules](../../../docs/adr/0007-share-participant-journeys-and-cap-claims-by-funding-rules.md)
- [Return Claims for Partner Correction](../../../docs/adr/0008-return-claims-for-partner-correction.md)
- [Approve Claims Before Recording Payment](../../../docs/adr/0009-approve-claims-before-recording-payment.md)
- [Reject and Reopen Claims](../../../docs/adr/0010-reject-and-reopen-claims.md)
- [Complete Claim Submission and Payment Workflow](../../../docs/adr/0011-complete-claim-submission-and-payment-workflow.md)

## End-to-end test account

Use this disposable shared-database account for local Cost Tracker authentication checks:

- **Email:** `cost-tracker-e2e-20260907@henningsieh.de`
- **Password:** `CostTrackerTest!2026`
- **Status:** email verified; it has no Organization Membership and therefore no Project access.

Do not grant this account roles or add it to an Organization. The IMAP-backed
`pnpm --filter @greendex/cost-tracker test:email-delivery` check sends and then
deletes its own verification-email fixture; it does not use this account.

## Scope

Cost Tracker owns the rules for Project Partnerships, Claims, Payout Accounts, Proof Documents, Travel Cost Entries, Cost Allocations, and funding review. Participant Journeys, Organizations, Projects, Users, Project Participations, and transport configuration are shared repository-level concerns. The Cost Tracker model defines its persistence semantics; `@greendex/database` owns their future Drizzle implementation and migrations.
