# Cost Tracking

Cost Tracker records journey-ticket costs for Project Participants through Project-specific Partner Organizations. Shared terms are defined in [GLOSSARY.md](../../GLOSSARY.md).

## Language

**Project Partnership**:
The assignment of one Partner Organization to one Project, not a global relationship between Organizations.
_Avoid_: Organization Partnership, Organization role

**Hosting Organization**:
The Organization that owns the Project, not a type or attribute of Organization.
_Avoid_: Host Organization, Host

**Partner Organization**:
An Organization assigned to one Project through a Project Partnership. The same Organization may be the Hosting Organization of another Project.
_Avoid_: Partner (when referring to the Organization)

**Project Participation**:
The record that one User takes part in one Project, belonging to the Project rather than to a Partner Organization.
_Avoid_: Partner's participants, Membership, Invitee

**Participant Agreement**:
The app-wide, versioned EU–Erasmus agreement in Cost Tracker, accepted by a User rather than by a Project Participation.
_Avoid_: Rules, Project-specific agreement

**Invitee**:
A person targeted by a Participant Invitation or Participant Registration Link before a Project Participation exists for them in that Project.
_Avoid_: Participant, Project Participation

**Participant Invitation**:
An app-owned invitation bound to one email address, issued by the Partner Organization administering a Project Partnership.
_Avoid_: Participant Registration Link, Organization Invitation, Better Auth invitation

**Participant Registration Link**:
A shareable, app-owned participant entry point issued by the Partner Organization administering a Project Partnership, not bound to an email address.
_Avoid_: Participant Invitation, Organization Invitation, bearer token

**Organization Invitation**:
An invitation into an Organization role for colleagues, distinct from participant entry into a Project Partnership. Only defined shared role values may be invited, assigned, or seeded; staff invitations remain limited to `owner` and `admin`.
_Avoid_: Participant Invitation, Participant Registration Link

**Review Task**:
A coordination object scoped to one Project Partnership concerning duplicate identity within a Project.
_Avoid_: Claim review, inline notice (as storage)

**Cost Submission Window**:
A legacy Project-wide submission-phase concept, retained as read-only state rather than a gate on Claim work.
_Avoid_: Claiming phase, Claim phase

**Claim**:
One Partner Organization's funding request for one Project Partnership, grouping travel costs, supporting documents, allocations, and payout details.
_Avoid_: Cost Submission

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
