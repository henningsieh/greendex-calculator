# Cost Tracking

Cost Tracker records journey-ticket costs for Project Participants through Project-specific Partner Organizations. Shared terms are defined in [GLOSSARY.md](../../GLOSSARY.md).

## Language

**Project Partnership**:
The assignment of one Partner Organization to one Project, not a global relationship between Organizations. A Project may have zero or more Project Partnerships with distinct Partner Organizations.
_Avoid_: Organization Partnership, Organization role

**Hosting Organization**:
The Organization that owns the Project, not a type or attribute of Organization.
_Avoid_: Host Organization, Host

**Partner Organization**:
An Organization assigned to one Project through a Project Partnership. The same Organization may be the Hosting Organization of another Project.
_UI label_: Partner (plural: Partners). Use Partner Organization when the full domain name is needed in technical documentation. A Partner is not a Partnership.

**Project Participation**:
The record that one User takes part in one Project, belonging to the Project rather than to a Partner Organization.
_Avoid_: Partner's participants, Membership, Invitee

_UI label_: Participation (plural: Participations) when coordinators work with Project Participation records. Participant still means the person, including when they register, accept the Participant Agreement, or enter their journey.

**Participant Agreement**:
The app-wide, versioned EU–Erasmus agreement in Cost Tracker, accepted by a User rather than by a Project Participation.
_Avoid_: Rules, Project-specific agreement

**Invitee**:
A person targeted by a Participant Invitation or Participant Registration Link before a Project Participation exists for them in that Project.
_Avoid_: Participant, Project Participation

**Participant Onboarding**:
The workflow through which an Invitee becomes a Participant in a Project using a Participant Invitation or Participant Registration Link, including authentication, required information, and acceptance of the current Participant Agreement.
_Avoid_: Participant Entry (when naming the complete workflow), Organization Onboarding

**Participant Invitation**:
An app-owned invitation bound to one email address, issued by the Partner Organization administering a Project Partnership.
_Avoid_: Participant Registration Link, Organization Invitation, Better Auth invitation

**Participant Registration Link**:
A shareable, app-owned participant entry point issued by the Partner Organization administering a Project Partnership, not bound to an email address.
_Avoid_: Participant Invitation, Organization Invitation, bearer token

**Organization Invitation**:
An invitation into an Organization role for colleagues, distinct from participant entry into a Project Partnership.
_Avoid_: Participant Invitation, Participant Registration Link

**Review Task**:
A review work item scoped to one Project Partnership concerning duplicate identity within a Project.
_Avoid_: Claim review, inline notice (as storage)

**Claim**:
One Partner Organization's funding request for one Project Partnership, grouping travel costs, supporting documents, allocations, and payout details. Each Project Partnership has at most one Claim, so a Project may have several Claims.
_Avoid_: Cost Submission

**Claim in preparation**:
A Claim in its initial preparation state before its first submission. This describes the Claim, not a Project-wide preparation phase; a Claim returned for correction has a separate state.
_Avoid_: Editable (as a status name), Project preparation phase

**Settled Claim**:
A Claim that is paid or rejected, with no payment remaining to be recorded under its current decision.
_Avoid_: Approved Claim (when meaning settled)

**Cost Tracker Project archive**:
The confirmed closure of a Project's Claim administration, with a settled Claim for every Project Partnership or no Partnerships present. It is not the end of the real-world Project.
_Avoid_: Project completion, Cost Submission Window

**Payout Account**:
A reusable bank account owned by one Partner Organization and selected by a Project Partnership for its Claim.
_Avoid_: Claim bank details

**Proof Document**:
An uploaded receipt, invoice, or ticket supporting one or more Travel Cost Entries in the same Claim.
_Avoid_: Travel Cost Entry, Ticket (as a generic Cost Tracker entity)

**Ticket**:
An everyday real-world term for a travel document that may serve as a Proof Document, not a canonical Cost Tracker domain entity.
_Avoid_: Travel Cost Entry, Cost Allocation, generic Proof Document

**Travel Cost Entry**:
The exact EUR cost recorded for one configured transport choice, potentially covering several Project Participations.
_Avoid_: Ticket (when referring to the cost record), Participant Journey

**Cost Allocation**:
The association between one Travel Cost Entry and one covered Project Participation.
_Avoid_: Beneficiary, Claimant

**Coordination** (internal, not a domain entity):
The permission scope an actor holds inside one Project Partnership: the Hosting Organization side or the Partner Organization side. It is an authorization concept only, so schemas and identifiers name the entity whose data they describe instead of reusing this word.
_Avoid_: CoordinationId, CoordinationIdSchema, coordination object, coordination helper module
