# Cost Tracking

Cost Tracker records journey-ticket costs for Project Participants. It adds Project-specific Partner Organizations without exposing that distinction to Calculator. It uses the shared Greendex language in [`DOMAIN-GLOSSARY.md`](../../DOMAIN-GLOSSARY.md).

## Language

**Project Partnership**:
The assignment of one Partner Organization to one Project. The Project's owning Organization occupies the hosting side; the assignment does not create a global relationship between the Organizations.
_Avoid_: Organization Partnership, Organization role

**Hosting Organization**:
The Organization that owns the Project. The Hosting Organization is derived from the Project and is not a type or attribute of Organization.
_Avoid_: Host Organization, Host

**Partner Organization**:
An Organization assigned to one Project through a Project Partnership. The same Organization may own another Project and therefore be its Hosting Organization.
_Avoid_: Partner (when referring to the Organization)

**Participant Agreement**:
The app-wide versioned EU–Erasmus agreement in Cost Tracker. Acceptance belongs to the User, not to the Project Participation, and is stored with version and content hash as historical evidence. The current version gates Participant access: `join` and `listMyProjects` require acceptance of the current version; a new version requires renewed acceptance. The current `eu-erasmus-dev-v1` copy is a development-only draft; production use requires counsel-approved replacement copy and a new version.
_Avoid_: Rules, Project-specific agreement

**Invitee**:
A person targeted by a Participant Invitation or a Participant Registration Link, before join completes and before a Project Participation exists for that person in that Project.
_Avoid_: Participant, Project Participation

**Participant Invitation**:
An email-bound invitation that grants the Invitee the `participant` role in the Hosting Organization, linked by a bridge record to exactly one Project Partnership. It never creates Membership in the Partner Organization.
_Avoid_: Participant Registration Link, Organization Invitation

**Participant Registration Link**:
A shareable app-owned registration entry point for exactly one Project Partnership. Anyone holding the link may start onboarding with their own account; no email and no Better Auth invitation are involved.
_Avoid_: Participant Invitation, Organization Invitation

**Organization Invitation**:
A Better Auth invitation into an Organization role (`owner`, `admin`) for colleagues. Better Auth's fallback role value `member` is forbidden (ADR-0012); it must never be invited, assigned, or seeded. It carries no Project Partnership bridge and grants no Participant access.
_Avoid_: Participant Invitation, Participant Registration Link

**Review Task**:
A persisted coordination object scoped to one Project Partnership about duplicate identity (the same User or the same email twice in one Project). States are open, assigned, resolved. Resolution feeds the merge-review flow that decides which Project Participation survives.
_Avoid_: Claim review, inline notice (as storage)

**Cost Submission Window**:
Legacy read-only Project flag (`cost_submission_window_open`). It no longer gates Claim work: there is no manual Project-wide Claim phase. Retained only until the implemented field is removed.
_Avoid_: Claiming phase, Claim phase

**Claim**:
One Partner Organization's funding request for one Project Partnership. A Claim groups Travel Cost Entries, Proof Documents, Cost Allocations, payout details, review, decision, and payment. Its covered Participants are derived from Cost Allocations, not copied into the Claim. Its funding cap uses the immutable rules and rates copied for its Project. When Hosting staff find incorrect data, they return the whole Claim for correction; the Partner-side Project Coordinator corrects and resubmits it. Defined Hosting-side roles may reject an ineligible Claim with a reason and reopen an unpaid rejected Claim if that decision was mistaken. Approval confirms the payable amount; later payment recording confirms that one full transfer was sent. The MVP uses a binary paid flag and does not support partial payments.
_Avoid_: Cost Submission

**Payout Account**:
A reusable bank account owned by one Partner Organization. A Partner Organization may have zero or more Payout Accounts; each Project Partnership selects one by reference for its Claim. A Claim cannot be created until its Project Partnership has selected a Payout Account.
_Avoid_: Claim bank details

**Proof Document**:
An uploaded receipt, invoice, or ticket that supports one or more Travel Cost Entries in the same Claim.
_Avoid_: Travel Cost Entry, Ticket (as a generic Cost Tracker entity)

**Ticket**:
An everyday real-world term for a travel document. A physical or PDF ticket may be a Proof Document; Ticket is not a canonical Cost Tracker domain entity and must not name a Travel Cost Entry or Cost Allocation.
_Avoid_: Travel Cost Entry, Cost Allocation, generic Proof Document

**Participant Journey**:
One Participant's real journey to or from a Project. It belongs to that Participant's Project Participation and is shared with Calculator. The MVP permits exactly one per Project Participation. A Partner-side Project Coordinator records its origin, destination, trip type (`one-way` or `round-trip`), and Erasmus Distance-Calculator distance used to select a funding band; it is not a cost record.
_Avoid_: Ticket, Travel Cost Entry, Partner Organization distance

**Travel Cost Entry**:
The exact EUR cost recorded for one configured transport choice. One entry may cover several Project Participations.
_Avoid_: Ticket (when referring to the cost record), Participant Journey

**Cost Allocation**:
The association between one Travel Cost Entry and one covered Project Participation. The Travel Cost Entry selects one allocation method for all of its Cost Allocations.
_Avoid_: Beneficiary, Claimant

## Read next

Owning behavior: [cost-tracker docs](docs/README.md). Other contexts: [Calculator](../../apps/calculator/CONTEXT.md), [Documentation](../../apps/documentation/CONTEXT.md). Change route: [domain](../../docs/agents/domain.md).
