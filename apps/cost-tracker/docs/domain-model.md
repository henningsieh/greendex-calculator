# Cost Tracker Cost Model and Schema Blueprint

Status: approved design; documentation only. No Drizzle schema or migration implements this model yet.

Read these sources first:

1. [Shared Project model](../../../docs/projects/model.md)
2. [Shared Project permissions](../../../docs/projects/permissions.md)
3. [Cost Tracker Projects](projects/README.md)
4. [Cost Tracking language](../CONTEXT.md)

The shared documents own Organization, Project, Project Participation, invitation, and role rules. This document owns only Cost Tracker behavior and persistence.

## Context boundary

Cost Tracker records journey-ticket costs for shared Project Participations.

- Calculator owns questionnaire answers, Participant Travel Legs, Project Shared Travel Legs, and carbon-footprint calculation.
- Cost Tracker owns Cost Submission Windows, Cost Submissions, Proof Documents, Travel Cost Entries, and Cost Allocations.
- Both applications use the same configured Participant transport choices.
- Cost records and Calculator journey records remain independent in the MVP.

## Cost Submission Window

Each Project has one manually controlled open/closed Cost Submission Window.

### Open

- Participants may create completed Cost Submissions.
- Logged-in Participants may edit submissions they entered.
- Participants who have not accepted their Better Auth invitation may create a new submission but cannot reopen existing data.
- Hosting Organization staff may create and correct submissions.

### Closed

- Participants cannot create or edit submissions.
- Hosting Organization staff may still create and correct submissions.

Window changes never alter Better Auth Memberships or roles.

## Cost Submission

A Cost Submission belongs to one Project and groups completed cost information.

```text
Cost Submission
├── who entered the form
├── one or more Travel Cost Entries
└── one or more Proof Documents
```

The MVP has no unfinished drafts. Persisting a Cost Submission is one transaction that satisfies every completion rule.

The submission records who entered the form separately from everyone covered by its entries:

- Participant entry references the entering Project Participation.
- Staff entry references the authenticated Hosting Organization User.
- Exactly one entry source is recorded.

A group ticket may cover the entering Participant and any number of other Project Participations. The Cost Allocations—not the entry-source field—identify everyone covered.

## Proof Documents

A completed Cost Submission contains at least one Proof Document. A document may support several Travel Cost Entries, and every Travel Cost Entry links to at least one Proof Document from the same Cost Submission.

The relational model stores document identity and entry-to-document associations. File storage, malware scanning, retention, and download authorization remain implementation concerns.

## Travel Cost Entry

One Travel Cost Entry records:

- one Cost Submission;
- one transport choice from the shared Calculator/Cost Tracker configuration;
- one exact EUR total;
- one allocation method;
- one or more covered Project Participations.

EUR is the only MVP currency. Monetary values use PostgreSQL exact `numeric`/`decimal` and decimal application arithmetic, never binary floating point.

A single invoice may support several single-transport entries. Cost Tracker therefore keeps Proof Document and Travel Cost Entry as separate concepts.

Travel Cost Entries do not create, update, or reference Calculator Participant Travel Legs in the MVP. The shared transport configuration is their only direct connection.

## Cost Allocation

One Cost Allocation connects a Travel Cost Entry to one covered Project Participation. Every covered Project Participation belongs to the same Project as the Cost Submission.

One method applies to the whole Travel Cost Entry:

### Equal

Store the covered Project Participations but no calculated monetary shares. Divide the original exact total when calculations or statistics are requested. Round only for UI presentation.

### Percentage

Store one entered exact percentage per covered Project Participation. The percentages total exactly 100 percent.

### Amount

Store one entered exact EUR value per covered Project Participation. The values total exactly the Travel Cost Entry's original amount.

Percentage and EUR inputs cannot be mixed within one entry. Plausibility checks reject missing Participants, negative values, incorrect totals, cross-Project allocations, and document links from another Cost Submission.

## Editing and authorization

| Action                                          | Participant without login   | Logged-in Participant | Hosting Organization staff    |
| ----------------------------------------------- | --------------------------- | --------------------- | ----------------------------- |
| Create while window open                        | yes                         | yes                   | yes                           |
| Reopen existing submission                      | no                          | own submissions       | yes                           |
| Edit while window open                          | current new submission only | own submissions       | yes                           |
| Create or edit after closure                    | no                          | no                    | yes                           |
| View another Participant's personal submissions | no                          | no                    | according to staff permission |

Email matching never unlocks a submission. Logged-in personal access requires the shared Project Participation to be linked to the authenticated User.

## Duplicate Project Participations

The shared [merge process](../../../docs/projects/model.md#merge-behavior) moves Cost Tracker references to the surviving Project Participation in one transaction:

- Cost Allocation references;
- the Participant entry-source reference on Cost Submission;
- any future Cost Tracker reference to Project Participation.

The duplicate remains as merge history.

## Proposed Cost Tracker Drizzle schema

This section is the approved migration blueprint, not current schema. Shared Project table changes are defined in [the shared Project model](../../../docs/projects/model.md#proposed-shared-drizzle-schema).

### `cost_submission`

- `id` primary key
- `project_id` required foreign key to `project`
- `entered_by_project_participant_id` nullable foreign key to `project_participant`
- `entered_by_user_id` nullable foreign key to Better Auth `user`
- `submitted_at` required timestamp
- creation and update timestamps

Exactly one `entered_by_*` field is present. There is no draft status in the MVP.

Completion requires at least one Travel Cost Entry and at least one Proof Document in the same transaction.

### `cost_proof_document`

- `id` primary key
- `cost_submission_id` required foreign key
- stable file reference
- original file name
- media type
- byte size
- checksum
- creation timestamp

### `travel_cost_entry`

- `id` primary key
- `cost_submission_id` required foreign key
- shared Participant transport value
- `amount` required exact EUR `numeric`
- `allocation_method` required enum: `equal`, `percentage`, or `amount`
- creation and update timestamps

No currency column is required in the EUR-only MVP.

### `travel_cost_entry_participant`

- `travel_cost_entry_id` required foreign key
- `project_participant_id` required foreign key
- `percentage` nullable exact `numeric`
- `amount` nullable exact EUR `numeric`
- composite primary key `(travel_cost_entry_id, project_participant_id)`

Method rules:

- `equal`: both value columns are null;
- `percentage`: `percentage` is present and `amount` is null;
- `amount`: `amount` is present and `percentage` is null.

The implementation validates method consistency, cross-row totals, and same-Project participation in the write transaction. Migration-level PostgreSQL constraints or triggers enforce cross-table invariants where ordinary row checks cannot.

### `travel_cost_entry_document`

- `travel_cost_entry_id` required foreign key
- `cost_proof_document_id` required foreign key
- composite primary key across both references

Both records belong to the same Cost Submission. Every Travel Cost Entry has at least one link.

## Deferred decisions

- Approval or rejection workflow
- Participant account recovery beyond Better Auth invitation acceptance
- Personal capability links for Participants without login
- Multiple currencies and conversion
- Direct links between Travel Cost Entries and Calculator journey records
- Partner-wide management roles and Partner Organization workflows

## Decision records

- [ADR-0001: Project Organizations and Project Participation](../../../docs/adr/0001-model-project-organizations-and-participation.md)
- [ADR-0002: Participant integration with Better Auth](../../../docs/adr/0002-integrate-participants-with-better-auth.md)
- [ADR-0003: Cost Submissions and Travel Costs](../../../docs/adr/0003-model-cost-submissions-and-travel-costs.md)
