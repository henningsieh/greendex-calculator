# Cost Tracker Domain Behavior

This reference owns Cost Tracker's behavioral and persistence rules; [the glossary](../GLOSSARY.md) owns terminology. Existing [ADRs](../../../docs/adr/README.md) and the [Claim workflow](claim-workflow.md) retain their authority.

## Participation and entry points

- A Project Participation is unique per User per Project. Its Participant Membership lives in the Project's Hosting Organization, not the Partner Organization. Its `country` is set by the Participant on joining and may be corrected by an administrator; it is not a User profile attribute.
- Participant Agreement acceptance belongs to the User and is stored with version and content hash as historical evidence. `join` and `listMyProjects` require acceptance of the current version; a new version requires renewed acceptance. The current `eu-erasmus-dev-v1` copy is a development-only draft; production use requires counsel-approved replacement copy and a new version.
- A Participant Invitation is an app-owned token redeemable only by its bound email address. A Participant Registration Link is an app-owned token redeemable by anyone holding it with their own account. Both are issued by the Partner Organization administering the Project Partnership and grant the Hosting Organization's `participant` role plus one Project Participation, never Membership in the Partner Organization. The Hosting Organization issues no participant entry points.
- Organization Invitations use Better Auth roles `owner` or `admin` for colleagues. They carry no Project Partnership bridge and grant no Participant access. Better Auth's fallback role `member` must never be invited, assigned, or seeded in Cost Tracker ([ADR-0012](../../../docs/adr/0012-ban-fallback-member-role-in-cost-tracker.md)).
- Under the single-Organization policy, an email-matching, pending, unexpired Organization Invitation containing `owner` or `admin`, including combined roles, blocks Organization creation independently of Membership. Participant-only and Project Coordinator-only invitations do not block creation.
- Rejection closes only the named Organization Invitation. Rejection and recheck reassess current eligibility and any remaining invitations while retaining the entry destination and Partner setup recovery checkpoint. An uncertain creation checkpoint continues to prevent repeat creation.
- Review Tasks have open, assigned, and resolved states. Resolution feeds the merge-review flow that decides which duplicate Project Participation survives when the same User or email occurs twice in one Project.

## Project creation

Participant-only Memberships are read-only for Project management: neither the UI nor the creation API grants Project creation or creation-driven role escalation. A User who also holds a staff role retains that role's authority.

## Partner Organization setup

- Setup links are recipient-bound. The authenticated User must have the verified recipient email address. The server validates the secret, enabled state, expiry, and Project availability before the UI offers Organization creation, and checks them again before binding.
- Better Auth creates the Organization and grants creator Ownership. The creation procedure returns its exact Organization ID. It preserves an existing acting Organization; first creation makes the new Organization active.
- Creation and Partnership binding are independent operations, not one atomic transaction. A later binding refusal or an uncertain response never deletes the User-owned Organization. The UI explains incomplete setup and inspects an uncertain binding result before permitting another binding attempt.
- A same-browser checkpoint stores the exact returned Organization ID per authenticated User and setup link, without the secret. Retry, revisit, and reload reuse that ID through the existing-Organization redemption path. If the creation response itself is lost, the UI blocks repeat creation and asks the User to inspect and select an existing Organization. Unavailable browser storage blocks new creation rather than losing its recovery identity.
- Eligibility inspection and replay remain server-authoritative. Only an Organization Owner can redeem or recover a completed setup. Replaying successful setup creates no duplicate Partnership or Membership. Setup never grants Hosting Organization Membership.
- Completion does not silently change an unrelated acting Organization. The User explicitly selects the Partner Organization through Better Auth. One protected-context refresh completes before a separate Project navigation becomes available in the original session. Missing or refused context selection leaves Project navigation unavailable.

## Journeys and transport

- Exactly one Participant Journey is permitted per Project Participation in the MVP. A Partner-side Project Coordinator records origin, destination, trip type (`one-way` or `round-trip`), and Erasmus Distance-Calculator distance for funding-band selection. The journey is shared with Calculator, not a cost record.
- Cost Tracker reuses Calculator's Participant transport profile set, `PARTICIPANT_TRANSPORT_EMISSION_PROFILES`; Calculator's Project Shared Travel profile set remains narrower.

## Claims and payouts

- Covered Participants are derived from Cost Allocations, not copied into a Claim. The funding cap uses immutable rules and rates copied for the Project.
- Hosting staff return the whole Claim when data needs correction; the Partner-side Project Coordinator corrects and resubmits. Defined Hosting-side roles may reject an ineligible Claim with a reason and reopen an unpaid rejection if the decision was mistaken.
- Approval confirms the payable amount; later payment recording confirms one full transfer. The MVP has a binary paid flag and no partial payments. See [Claim workflow](claim-workflow.md) for the complete state and access rules.
- A Partner Organization may have zero or more reusable Payout Accounts. Each Project Partnership selects one by reference; a Claim cannot be created until that selection exists.
- One allocation method applies to all Cost Allocations on a Travel Cost Entry.
- There is no manual Project-wide Claim phase.

## Cost Tracker archive and reopening

[ADR-0027](../../../docs/adr/0027-archive-settled-cost-tracker-projects.md) establishes archive and reopening for Cost Tracker. [#416](https://github.com/henningsieh/greendex-calculator/issues/416) records the implementation and subsequent setup-link closure decision.

- A Project has zero or more Project Partnerships, each with at most one Claim. A Claim is settled when paid or rejected. Approved unpaid Claims are not settled. No additional Claim-close action or status follows payment or rejection.
- Archive is the explicit confirmation that the Project's Claim administration is settled, not that the real-world Project has ended. Every existing Project Partnership must have a paid or rejected Claim. A Partnership without a Claim blocks archive; no Partnerships means there is nothing to settle and archive is permitted.
- Readiness is derived from Claims. There is no separate “review finished” confirmation or stored readiness phase. Archive does not change Claim statuses.
- Hosting Organization Owners and Admins may archive their Projects; Hosting-side Project Coordinators may archive explicitly assigned Projects. Partner-side authority does not grant archive.
- Archive and reopen use the context-specific `costTrackerProjectLifecycle` resource and the shared full executor-backed decision described in [ADR-0028](../../../docs/adr/0028-scope-project-lifecycle-permissions-by-application.md). Reopening is limited to the Hosting Organization's Owners and Admins; Project Coordinators and Partner-side roles do not receive it. A reason is required. Responsible User, time and prior archive/reopen cycles remain traceable.
- Reopening changes Project availability, not Claim statuses. A later payment correction or rejected-Claim reopening remains a separate authorized Claim action with its existing audit rules.
- Archiving closes all Project setup links in the same transaction. New setup links cannot be created while the Project is archived. Reopening does not reactivate closed links; an authorized User may create a new link after reopening.
- Archived Project-scoped data is read-only through Cost Tracker: Claims, selected Payout Account, Project Partnerships, Project Participations, Participant Journeys and setup/onboarding writes cannot be changed without reopening. Existing authorized reading remains available. Shared reusable Organization data, including Payout Accounts used elsewhere, is not globally frozen.
- Archive and Project-scoped mutations must check availability atomically so concurrent work cannot invalidate settlement after archive. Permission checks are authoritative on the server.
- Cost Tracker archive state is independent of Calculator archive state. Neither app's archive/unarchive action changes the other's workflow state. Shared entities remain shared: this rule does not promise an immutable snapshot against changes made through other authorized contexts.

### Archive presentation

- Use “Archivieren” for the Project-level action, not “Project abschließen”. Initial Claim status is “In Vorbereitung” / “In preparation”, internally `in_preparation`; `correction_requested` remains distinct. The first-create button is “Erstattungsantrag erstellen” / “Create claim”.
- Archive uses the existing reusable [confirmation dialog](confirm-dialog.md) as a destructive action. Explain that data becomes read-only, the Project leaves the default active list, and only authorized Users may reopen it. Cancellation changes nothing.
- Actions unavailable because of archive remain visible and disabled, with an independent explanation that works by keyboard and touch. The assigned Partner Organizations card is the deliberate exception: its Invite/Assign controls are replaced by an Archived badge, as accepted in the partnership UI redesign. The card's records remain readable.
- Never mention the Calculator app in Cost Tracker user-facing archive/reopen text. Cross-application separation is an engineering rule, not UI copy.
- Archived Projects remain reachable through the Project-list archive filter and their authorized detail views. See [Projects](projects/README.md) for derived settlement filters and sorting.
