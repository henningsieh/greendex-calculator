# Cost Tracker Engineering Documentation

These documents describe behavior owned by the Cost Tracker application.

## Read first

- [Cost Tracking glossary](../GLOSSARY.md)
- Other contexts: [Calculator](../../../apps/calculator/GLOSSARY.md) · [Documentation](../../../apps/documentation/GLOSSARY.md) — overview in [Glossary map](../../../GLOSSARY-MAP.md)
- [Cost Tracker architecture](architecture.md)
- [Prefetch and Suspense route audit](prefetch-suspense-audit.md) — consult when changing server-prefetched Cost Tracker routes
- [Shared Greendex language](../../../GLOSSARY.md)
- [Shared Projects documentation](../../../docs/projects/README.md)
- [Cost Tracker Projects](projects/README.md)
- [User settings](user-settings.md)
- [Cost model and schema blueprint](domain-model.md)
- [Claim workflow](claim-workflow.md)
- [Current domain behavior](domain-behavior.md) — participation, invitations, agreements, transport, and Claim invariants extracted from the former app context
- [Clickdummy use-case traceability](clickdummy/requirements-traceability.md)
- [Garage S3 infrastructure](infrastructure/garage.md)
- [Manual pair-testing (journey script, run logs, session protocol)](manual-testing/)

## Open work

Start here when you need to know what still needs a decision. Nothing in this list is history.

- [Backlog](backlog/) — deferred questions and follow-ups. Begin with the [six open questions from the Phase 0–8 architecture review](backlog/architecture-review-open-questions.md).
- [Erasmus re-theme tracking](design/erasmus-billing-accounting-theme.md) — Billing/Accounting redesign chain: approved prototype, palette, fonts, hover language, and lint migration.
- [Project/Partner cardinality](backlog/project-partner-cardinality.md) — can one Project have more than one Partner Organization, or is one Partner Organization per Project the real rule?
- [GitHub issues](https://github.com/henningsieh/greendex-calculator/issues) — canonical surface for issues and specs; see [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md).

## Archive

Finished work. These files describe the codebase as it stood in September 2026. Do not follow them as instructions.

- [Archived architecture reviews](archive/) — the completed Phase 0–8 migration review, its findings, its fix plan, and its final verdict. The architecture migration is accepted and closed.

## Decisions

- [Project Organizations and Project Participation](../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [Participant integration with Better Auth](../../../docs/adr/0002-integrate-participants-with-better-auth.md)
- [Cost Submissions and Travel Costs](../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md) — superseded by ADR-0006, ADR-0007, and ADR-0011
- [Scope Project Coordination Through Assignments](../../../docs/adr/0004-scope-project-coordination-through-assignments.md)
- [Require Authenticated Participant Onboarding and an App-Wide Agreement](../../../docs/adr/0005-require-authenticated-participant-onboarding.md) — supersedes ADR-0002 in part
- [Derive Claim Participants Through Cost Allocations](../../../docs/adr/0006-derive-claim-participants-through-cost-allocations.md)
- [Share Participant Journeys and Cap Claims by Funding Rules](../../../docs/adr/0007-share-participant-journeys-and-cap-claims-by-funding-rules.md)
- [Return Claims for Partner Correction](../../../docs/adr/0008-return-claims-for-partner-correction.md)
- [Approve Claims Before Recording Payment](../../../docs/adr/0009-approve-claims-before-recording-payment.md)
- [Reject and Reopen Claims](../../../docs/adr/0010-reject-and-reopen-claims.md)
- [Complete Claim Submission and Payment Workflow](../../../docs/adr/0011-complete-claim-submission-and-payment-workflow.md)
- [Ban Better Auth's Fallback Role in Cost Tracker](../../../docs/adr/0012-ban-fallback-member-role-in-cost-tracker.md)

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
