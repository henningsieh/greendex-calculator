# Participant Agreement — Draft Only

Status: DRAFT. Not legal text. Do not publish.

- Production stays on `"PENDING-LEGAL-001"`.
- `join` and `listMyProjects` stay closed in production.
- Tests continue with fixture `id` plus fixture `contentHash`.
- The project owner must supply the approved copy.
- Only then does `"PENDING-LEGAL-001"` change.

This draft exists for technical work only. It is a best guess. It creates no legal evidence.

## Draft Structure (Placeholder)

1. Purpose
   - This `Participant Agreement` defines the conditions for `Participant` access in Cost Tracker.
   - Owner to confirm the exact purpose.

2. Scope
   - App-wide. Versioned. EU–Erasmus scope per "ADR-0005".
   - One acceptance is valid for all `Project Participation` records of the same `User`.
   - Owner to confirm the scope.

3. Profile Data
   - The `User` provides a full name.
   - The profile belongs to the `User`, not to the `Project Participation`.
   - Owner to confirm the required fields.

4. Acceptance Storage
   - Acceptance stores version `id` plus `contentHash` as historical evidence.
   - A new version requires new acceptance.
   - Old acceptances stay stored.
   - Owner to confirm the storage rule.

5. Access Rule
   - No `Participant` action without acceptance of the current version.
   - This includes `join` and `listMyProjects`.
   - Owner to confirm the rule.

6. Roles
   - `User`, `Participant`, `Project Participation`, `Hosting Organization` per `apps/cost-tracker/CONTEXT.md`.
   - Owner to confirm the role names.

## Owner Decision Required

- [ ] Supply the approved copy, or approve this draft as a starting point.
- [ ] Assign the first public version `id` (example format: `eu-erasmus-v1`).
- [ ] Confirm the `contentHash` rule: hash of the exact published bytes.
- [ ] Confirm that every text change needs a new version plus new acceptance.
- [ ] Confirm where the copy lives in code (current proposal: next to `CURRENT_PARTICIPANT_AGREEMENT_VERSION`).

Until then: no code change. `"PENDING-LEGAL-001"` stays.
