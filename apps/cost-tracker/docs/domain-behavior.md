# Cost Tracker Domain Behavior

This reference owns Cost Tracker's behavioral and persistence rules; [the glossary](../GLOSSARY.md) owns terminology. Existing [ADRs](../../../docs/adr/README.md) and the [Claim workflow](claim-workflow.md) retain their authority.

## Participation and entry points

- A Project Participation is unique per User per Project. Its Participant Membership lives in the Project's Hosting Organization, not the Partner Organization. Its `country` is set by the Participant on joining and may be corrected by an administrator; it is not a User profile attribute.
- Participant Agreement acceptance belongs to the User and is stored with version and content hash as historical evidence. `join` and `listMyProjects` require acceptance of the current version; a new version requires renewed acceptance. The current `eu-erasmus-dev-v1` copy is a development-only draft; production use requires counsel-approved replacement copy and a new version.
- A Participant Invitation is an app-owned token redeemable only by its bound email address. A Participant Registration Link is an app-owned token redeemable by anyone holding it with their own account. Both are issued by the Partner Organization administering the Project Partnership and grant the Hosting Organization's `participant` role plus one Project Participation, never Membership in the Partner Organization. The Hosting Organization issues no participant entry points.
- Organization Invitations use Better Auth roles `owner` or `admin` for colleagues. They carry no Project Partnership bridge and grant no Participant access. Better Auth's fallback role `member` must never be invited, assigned, or seeded in Cost Tracker ([ADR-0012](../../../docs/adr/0012-ban-fallback-member-role-in-cost-tracker.md)).
- Review Tasks have open, assigned, and resolved states. Resolution feeds the merge-review flow that decides which duplicate Project Participation survives when the same User or email occurs twice in one Project.

## Journeys and transport

- Exactly one Participant Journey is permitted per Project Participation in the MVP. A Partner-side Project Coordinator records origin, destination, trip type (`one-way` or `round-trip`), and Erasmus Distance-Calculator distance for funding-band selection. The journey is shared with Calculator, not a cost record.
- Cost Tracker reuses Calculator's Participant transport profile set, `PARTICIPANT_TRANSPORT_EMISSION_PROFILES`; Calculator's Project Shared Travel profile set remains narrower.

## Claims and payouts

- Covered Participants are derived from Cost Allocations, not copied into a Claim. The funding cap uses immutable rules and rates copied for the Project.
- Hosting staff return the whole Claim when data needs correction; the Partner-side Project Coordinator corrects and resubmits. Defined Hosting-side roles may reject an ineligible Claim with a reason and reopen an unpaid rejection if the decision was mistaken.
- Approval confirms the payable amount; later payment recording confirms one full transfer. The MVP has a binary paid flag and no partial payments. See [Claim workflow](claim-workflow.md) for the complete state and access rules.
- A Partner Organization may have zero or more reusable Payout Accounts. Each Project Partnership selects one by reference; a Claim cannot be created until that selection exists.
- One allocation method applies to all Cost Allocations on a Travel Cost Entry.
- The legacy `cost_submission_window_open` Project flag remains read-only until removed. It no longer gates Claim work; there is no manual Project-wide Claim phase.
