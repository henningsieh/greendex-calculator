---
status: accepted
---

# Model Cost Submissions and Travel Costs

Cost Tracker will use a Project-level Cost Submission Window. A completed Cost Submission groups Proof Documents and single-transport Travel Cost Entries; each entry covers one or more Project Participations through one explicit allocation method.

## Context

Journey-ticket costs may cover one person or a group. One receipt or invoice may prove several cost lines, and one Cost Submission may contain several receipts and transport choices. Participants without login may submit during the MVP, authenticated Participants need to edit their own submissions while the window is open, and Hosting Organization staff need to enter and correct records on their behalf.

Cost allocations must support an equal default and manual overrides without storing rounded presentation values. Calculator already owns the selectable Participant transport configuration, while Cost Tracker owns monetary data. The applications need aligned transport vocabulary without coupling cost records directly to carbon-calculation records.

## Decision

### Cost Submission Window

- Each Project has one manually controlled open/closed Cost Submission Window.
- While open, Participants may create Cost Submissions and authenticated Participants may edit submissions they entered.
- A Participant who has not accepted the Better Auth invitation may complete an unsubmitted form and persist it once, but cannot reopen or edit the persisted submission.
- Authenticated personal access requires both Membership in the Project's Hosting Organization and the relevant Project Participation linked to the User.
- After closure, Participants cannot create or edit submissions.
- Authorized Hosting Organization staff may create and correct submissions whether the window is open or closed.
- Window state has no effect on Better Auth Memberships or roles.

### Cost Submission

- A Cost Submission belongs to exactly one Project.
- The MVP persists completed submissions only; it has no unfinished drafts.
- A completed Cost Submission contains at least one Travel Cost Entry and at least one Proof Document.
- The database records who entered the form separately from the Project Participations whose journeys are covered.
- Participant entry records the entering Project Participation. Staff entry records the authenticated User. Exactly one source is present.
- The approval/rejection workflow remains backlog and is not represented in the MVP status model.

### Proof Documents

- A Proof Document belongs to one Cost Submission.
- Travel Cost Entries and Proof Documents have an explicit many-to-many association.
- Every Travel Cost Entry links to at least one Proof Document from the same Cost Submission.
- One Proof Document may support several entries.

### Travel Cost Entry

- One Travel Cost Entry records one exact EUR total and one transport choice.
- The transport choice comes from the same shared Participant transport configuration used by Calculator.
- The configuration may be extended with additional selectable choices, but Cost Tracker does not maintain a competing list.
- Cost records and Calculator Participant Travel Legs remain independent in the MVP. Creating or changing one never creates or changes the other.
- EUR is the only MVP currency.
- PostgreSQL exact `numeric`/`decimal` and decimal application arithmetic represent money; binary floating point is excluded.

### Cost Allocation

- Every Travel Cost Entry covers one or more Project Participations from the same Project as the Cost Submission.
- One allocation method applies to the whole entry: `equal`, `percentage`, or `amount`.
- `equal`: store only the covered Project Participations; calculate shares from the original total when needed and round only for UI presentation.
- `percentage`: store one exact percentage per covered Project Participation; values must total exactly 100 percent.
- `amount`: store one exact EUR value per covered Project Participation; values must total exactly the entry total.
- Percentage and amount inputs cannot be mixed in one entry.
- Plausibility checks reject missing Participants, invalid values, wrong totals, cross-Project references, or proof links from another Cost Submission.

### Duplicate Project Participations

When duplicate Project Participations are merged, every cost-entry allocation and entering-Participant reference moves to the survivor in one transaction. If both participations occur on the same Travel Cost Entry, their allocations are consolidated before reassignment: retain one row for `equal`, add exact percentages for `percentage`, or add exact EUR values for `amount`. This preserves the original entry total and avoids a duplicate composite key. The duplicate remains as merge history.

## Considered options

### One Ticket record containing amount, document, mode, and Participants

Rejected because a single invoice may prove several single-mode entries. Separating Cost Submission, Proof Document, Travel Cost Entry, and Cost Allocation preserves each real relationship.

### One Travel Cost Entry per Participant

Rejected because group tickets have one original amount covering several Project Participations. Duplicating the amount per person would overcount Project costs and lose the group-ticket fact.

### Persist calculated equal shares

Rejected because values such as one third cannot be represented as a finite decimal, and stored rounded shares can drift from the original total. Equal shares are derived from the exact total and covered-Participant count.

### Permit mixed percentages and EUR amounts

Rejected because mixed entries require implicit remainder rules and are difficult to validate. Each entry chooses one method.

### Reuse Calculator journey records

Rejected for the MVP because Calculator records CO₂ inputs while Cost Tracker records receipts and group costs. They share transport configuration, not record identity.

### Multiple currencies immediately

Rejected for MVP scope. Adding currencies later requires an explicit conversion and reporting decision rather than an unused currency column with undefined semantics.

## Consequences

- Submission creation must be transactional because completion rules span several tables.
- Cross-row percentage and amount totals require transactional validation and may require migration-level PostgreSQL triggers for database enforcement.
- UI totals may show rounded values, while calculations continue from exact original totals and exact overrides.
- Staff corrections after window closure require a separate authorization path from Participant editing.
- File storage and malware-scanning policy remain implementation concerns, while document identity and entry links are relational data.
- Approval status, exchange rates, and direct Calculator journey linking remain explicit backlog items.

The detailed table blueprint is maintained in [`apps/cost-tracker/docs/domain-model.md`](../../apps/cost-tracker/docs/domain-model.md).
