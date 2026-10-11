---
status: accepted
supersedes:
  - 0003-model-cost-submissions-and-travel-costs.md
---

# Derive Claim Participants Through Cost Allocations

A Claim belongs to one Project Partnership. Its covered Participants are derived from its Travel Cost Entries and Cost Allocations; they are never copied into a separate Claim-Participant record.

## Context

The clickdummy calls a broad record a Claim and creates a snapshot row for every completed Participant when the Claim starts. Each copied row starts as `participated`, and the Partner Organization manually marks rows as not participating. The clickdummy's Ticket then links to those copied rows.

That structure mixes the real cost relationship with duplicate Participant data and an additional participation flag. It makes Claim membership an independently stored fact that can diverge from the costs the Claim actually requests.

Cost Tracker already distinguishes the concepts that the clickdummy calls Ticket:

```text
Participant Journey = one covered Participant's personal route and Erasmus Distance-Calculator distance
Travel Cost Entry  = one exact EUR amount and transport choice
Proof Document     = uploaded receipt, invoice, or ticket file
Cost Allocation    = the association between one Travel Cost Entry and one covered Project Participation
```

The full Cost Tracker flow now uses a Claim as the Partner Organization's one funding request for one Project Partnership. The Claim is a wrapper around its Travel Cost Entries, Proof Documents, allocations, review, decision, and payment.

## Decision

- One Claim belongs to exactly one Project Partnership. A Project Partnership has at most one Claim.
- Opening a Claim page creates no record. The first saved Claim information—such as a Travel Cost Entry, Proof Document, or payout detail—creates the editable Claim and saves that information in one operation.
- No separate `Start Claim` action or empty Claim record exists.
- A Claim owns one or more Travel Cost Entries.
- Every Travel Cost Entry belongs to one Claim and has one or more Cost Allocations.
- A Participant Journey belongs to one Project Participation and, in the MVP, each Project Participation has exactly one. It records that Participant's origin, destination, trip type (`one-way` or `round-trip`), and Erasmus Distance-Calculator distance. A Partner Organization or Project Partnership never supplies one assumed distance for all of its Participants.
- A Travel Cost Entry records one exact EUR total and one transport choice. It does not own a Participant's route, trip type, or Erasmus Distance-Calculator distance.
- A Cost Allocation references one Project Participation.
- The Participants covered by a Claim are derived as the distinct Project Participations referenced by its Cost Allocations.
- No Claim-Participant table, Participant snapshot, copied profile fields, or independent `participated` state exists.
- Each Cost Allocation in a Claim must reference a Project Participation that:
  - belongs to the Claim's Project; and
  - represents the Partner Organization assigned through the Claim's Project Partnership.
- A Proof Document belongs to one Claim and may support one or more of that Claim's Travel Cost Entries. Proof Documents and Travel Cost Entries keep their explicit many-to-many link.
- The existing exact-money and allocation-method rules remain applicable: a Travel Cost Entry uses `equal`, `percentage`, or `amount` allocations, and the applicable totals must match the original exact EUR amount.

The resulting relationship is:

```text
Claim
├─ Travel Cost Entry
│  ├─ Cost Allocation → Project Participation
│  └─ Proof Document link(s)
└─ … additional Travel Cost Entries
```

## Considered options

### Copy every Participant into the Claim

Rejected because copied rows duplicate persisted Participant data and create a second source of truth. Claim coverage is fully and more accurately represented by Cost Allocations.

### Store an independent `participated` flag on a Claim-Participant row

Rejected because a Claim reimburses costs, not an abstract attendance list. A Project Participation covered by no Claim allocation is not covered by that Claim; no extra flag is needed.

### Allow a Claim to allocate costs to any Participant in the Project

Rejected because a Claim is the responsibility of one Project Partnership. Allowing Youth Culture Berlin's Claim to cover a Dance Collective Participant would blur Partner Organization responsibility, financial visibility, and reimbursement boundaries.

### Combine Travel Cost Entry and Proof Document into Ticket

Rejected because one document may support several cost entries and one cost entry may need several supporting documents. The separate concepts preserve the real relationships.

## Consequences

- ADR-0003's Cost Submission aggregate and participant/staff direct-entry flow are superseded. Its exact-money, transport-choice, Proof Document, and allocation-method principles remain applicable where they do not conflict with this ADR or ADR-0007.
- The Cost Tracker domain model and future schema must replace the top-level Cost Submission with a Claim belonging to a Project Partnership.
- Claim views derive their covered-Participant list from Cost Allocations rather than a copied snapshot.
- Empty-state actions guide a Partner Organization directly to add cost, Proof Document, or payout information; opening the Claim area never persists an empty record.
- Server-side writes must enforce the Claim Project, Project Partnership, represented Organization, Travel Cost Entry, Proof Document, and Cost Allocation invariants transactionally.
- A future glossary session must explicitly map or reject the clickdummy's overloaded Ticket terminology; this ADR intentionally preserves the established Cost Tracker terms.
