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
