# Cost Tracker Engineering Documentation

These documents describe behavior owned by the Cost Tracker application.

## Read first

- [Cost Tracking context](../CONTEXT.md)
- [Cost Tracker architecture](architecture.md)
- [Architecture review and migration plan](architecture-review-and-migration-plan.md)
- [Architecture review after the migration fix (13 findings)](architecture-review-after-migration-fix.md)
- [Architecture migration fix plan](architecture-migration-fix-plan.md)
- [Shared Greendex language](../../../DOMAIN-GLOSSARY.md)
- [Shared Projects documentation](../../../docs/projects/README.md)
- [Cost Tracker Projects](projects/README.md)
- [User settings](user-settings.md)
- [Cost model and schema blueprint](domain-model.md)
- [Garage S3 infrastructure](infrastructure/garage.md)

## Decisions

- [Project Organizations and Project Participation](../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [Participant integration with Better Auth](../../../docs/adr/0002-integrate-participants-with-better-auth.md)
- [Cost Submissions and Travel Costs](../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)

## End-to-end test account

Use this disposable shared-database account for local Cost Tracker authentication checks:

- **Email:** `cost-tracker-e2e-20260907@henningsieh.de`
- **Password:** `CostTrackerTest!2026`
- **Status:** email verified; it has no Organization Membership and therefore no Project access.

Do not grant this account roles or add it to an Organization. The IMAP-backed
`pnpm --filter @greendex/cost-tracker test:email-delivery` check sends and then
deletes its own verification-email fixture; it does not use this account.

## Scope

Cost Tracker owns the rules for Project Partnerships, Cost Submission Windows, Cost Submissions, Proof Documents, Travel Cost Entries, and Cost Allocations. Shared Organizations, Projects, Users, Project Participations, and transport configuration remain repository-level concerns. The Cost Tracker model defines its persistence semantics; `@greendex/database` owns their future Drizzle implementation and migrations.
