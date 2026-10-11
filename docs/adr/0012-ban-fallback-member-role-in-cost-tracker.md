---
status: accepted
---

# Ban Better Auth's fallback role in Cost Tracker

## Decision

The human-ordered Cost Tracker domain ruling bans the Better Auth role value `member`. It is not a Greendex actor. Cost Tracker must never invite, assign, or seed it, either alone or as one token of a combined role. Omitted roles must not silently select Better Auth's fallback.

This supersedes ADR-0004's technical-fallback allowance for Cost Tracker only. Valid roles remain `owner`, `admin`, `project-coordinator`, and `participant`; their scopes and assignment requirements do not change. Table/model names such as `member`, `member.role` joins, and ordinary Membership wording are not role values and remain unchanged.

## Enforcement

Cost Tracker supplies native Better Auth hooks for invitation creation and acceptance, membership addition, and role updates through an optional shared-factory injection point. An early native invitation handler gate also validates requested roles and pending roles on resend: Better Auth 1.7 otherwise updates expiry and sends mail before its creation hook. Refusal tests model legacy pending roles only in memory, never by seeding forbidden values. The same validation gates app-owned acceptance and direct role-preserving writes. Organization staff invitations offer only `owner` and `admin`.

Journey case 10 invites M as `admin`: M is an Organization Admin, not its Owner, and has Organization-wide staff authority. ADR-0001 keeps Organization relationships separate from Membership; ADR-0002 keeps Membership separate from Project Participation. Acceptance creates neither Participation nor Partnership. M remains unable to select E's Organization as its Owner. Q uses `project-coordinator`, preserving that real role when onboarding adds `participant`.

The denied-scope fixtures use real `participant` or unassigned `project-coordinator` roles, never a fallback role. No assertions may be weakened to accommodate this ban. Legacy fallback behavior is no longer a requirements observation.

## Permission-definition naming and compatibility

The final definition identifiers are exactly `organisationOwner`, `organizationAdmin`, and `projectParticipant`. The source `organizationRoles` map groups legacy Calculator entries `admin: legacyCalculatorAdminRole` and `member: legacyCalculatorMemberRole` separately from those three domain-named definitions. Cost Tracker resolves the unchanged runtime role values as `owner: organisationOwner`, `admin: organizationAdmin`, `participant: projectParticipant`, and `project-coordinator: projectCoordinatorRole`; it has no fallback entry.

Calculator's runtime compatibility map retains its existing `owner`, `admin`, `member`, and `participant` values. Better Auth's hardcoded creator flow and existing stored Memberships therefore need no data migration. The new Organization Admin definition has exactly the prior admin statements. Tests compare every before/after permission statement for the same stored-role User, including combined roles. UI labels remain Organization Owner, Organization Admin, Project Coordinator / Group Organizer according to assignment scope, and Participant. Definition identifiers do not rename those actors or confer additional authority.

## Audit boundary

The pre-change repo-wide audit found Cost Tracker role values in staff invitations and their UI, onboarding preservation, coordinator eligibility, journey cases 10/19 and Project-creation observations, staff tests, onboarding tests, entity-search/create/setup-links/claims/participations/projects/submission integration fixtures, and hosting/partnership/onboarding/claim-review browser specs.

Calculator's runtime role values and authority remain unchanged; its permission-definition imports and the shared auth definitions were renamed under the human's final naming contract. Shared schema defaults, historical migrations/snapshots, Calculator fallback behavior, and i18n compatibility keys remain explicitly out of scope for the Cost Tracker ban. This is an app boundary ban, not a shared database schema migration. Test-owned fallback rows in the development database may be removed only after inspecting both their identity and their Organization ownership; non-test rows block cleanup rather than being silently changed.
