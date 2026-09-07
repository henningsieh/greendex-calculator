# Cost Tracking

Cost Tracker records journey-ticket costs for Project Participants. It adds Project-specific Partner Organizations without exposing that distinction to Calculator.

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
The Project-level period during which Participants may create or edit Cost Submissions. Hosting Organization staff may correct submissions after the window closes.
_Avoid_: Claiming phase, Claim phase

**Cost Submission**:
A completed set of one or more Travel Cost Entries and their Proof Documents entered for one Project.
_Avoid_: Claim

**Proof Document**:
An uploaded receipt, invoice, or ticket that supports one or more Travel Cost Entries in the same Cost Submission.
_Avoid_: Travel Cost Entry

**Travel Cost Entry**:
The exact EUR cost recorded for one configured transport choice. One entry may cover several Project Participations.
_Avoid_: Ticket (when referring to the cost record), Participant Travel Leg

**Cost Allocation**:
The association between one Travel Cost Entry and the Project Participations it covers, using one allocation method for the whole entry.
_Avoid_: Beneficiary, Claimant
