---
status: accepted
---

# Ban Better Auth's fallback role in Cost Tracker

## Decision

The human-ordered Cost Tracker domain ruling bans the Better Auth role value `member`. It is not a Greendex actor. Cost Tracker must never invite, assign, or seed it, either alone or as one token of a combined role. Omitted roles must not silently select Better Auth's fallback.

This supersedes ADR-0004's technical-fallback allowance for Cost Tracker only. Valid roles remain `owner`, `admin`, `project-coordinator`, and `participant`; their scopes and assignment requirements do not change. Table/model names such as `member`, `member.role` joins, and ordinary Membership wording are not role values and remain unchanged.

## Enforcement

Cost Tracker supplies native Better Auth hooks for invitation creation and acceptance, membership addition, and role updates through an optional shared-factory injection point. The same validation gates app-owned acceptance and direct role-preserving writes. Organization staff invitations offer only `owner` and `admin`.

Journey case 10 invites M as `admin`: M is an Organization Admin, not its Owner, and has Organization-wide staff authority. ADR-0001 keeps Organization relationships separate from Membership; ADR-0002 keeps Membership separate from Project Participation. Acceptance creates neither Participation nor Partnership. M remains unable to select E's Organization as its Owner. Q uses `project-coordinator`, preserving that real role when onboarding adds `participant`.

The denied-scope fixtures use real `participant` or unassigned `project-coordinator` roles, never a fallback role. No assertions may be weakened to accommodate this ban. Legacy fallback behavior is no longer a requirements observation.

## Audit boundary

The pre-change repo-wide audit found Cost Tracker role values in staff invitations and their UI, onboarding preservation, coordinator eligibility, journey cases 10/19 and Project-creation observations, staff tests, onboarding tests, entity-search/create/setup-links/claims/participations/projects/submission integration fixtures, and hosting/partnership/onboarding/claim-review browser specs.

Calculator code, shared auth role definitions, shared schema defaults, historical migrations/snapshots, and i18n compatibility keys are explicitly out of scope. Calculator remains unchanged. This is an app boundary ban, not a shared database schema migration. Test-owned fallback rows in the development database may be removed only after inspecting both their identity and their Organization ownership; non-test rows block cleanup rather than being silently changed.
