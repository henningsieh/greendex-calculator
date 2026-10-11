---
status: accepted
supersedes:
  - 0003-model-cost-submissions-and-travel-costs.md
---

# Share Participant Journeys and Cap Claims by Configurable Funding Rules

A Claim's calculated payable amount is capped by configurable travel-funding rules, not only by its approved costs. The cap is calculated from every covered Participant's own journey and its Erasmus Distance-Calculator distance; it is never stored once on a Partner Organization or Project Partnership.

## Context

The clickdummy has the correct high-level funding outcome: reimbursement cannot exceed both the approved travel costs and the applicable Erasmus travel funding. It implements that outcome incorrectly for Greendex: it stores one manually entered distance on a Project-specific Partner Organization record and hard-codes distance bands and rates in application source.

That distance cannot describe reality. Participants represented by the same Partner Organization may start in different places and therefore have different distances and funding entitlements.

Calculator and Cost Tracker both describe the same real-world journey. Calculator's current Participant Travel Leg is only derived questionnaire data and is not yet a persisted reusable route record. Cost Tracker is the first application to need the shared record; Calculator will adapt to it later.

## Decision

### Shared Participant Journey

- A **Participant Journey** belongs to one Project Participation and is the shared source for that Participant's real journey to or from that Project. The MVP permits exactly one Participant Journey per Project Participation.
- It records its own origin, destination, trip type (`one-way` or `round-trip`), and Erasmus Distance-Calculator distance in kilometres. That reference distance selects a funding band; the National Agency remains responsible for the final grant decision.
- Participant Journey data belongs neither to a Partner Organization nor to a Project Partnership. A Partner Organization may never have one assumed distance for all of its Participants.
- For the first Cost Tracker release, the Partner-side Project Coordinator prepares this data, manually uses the official Erasmus+ web calculator, and enters its returned distance. Participants do not create or edit Claims, Participant Journeys, Travel Cost Entries, or Proof Documents. Greendex does not depend on an undocumented calculator API.
- A Travel Cost Entry records an exact cost and transport choice; it does not own a Participant's route, trip type, or Erasmus Distance-Calculator distance.
- Cost Tracker implements Participant Journey first. Calculator will consume the same persisted journey data when its participant-travel model is adapted.

### Configurable funding cap

- Distance bands, standard and green rates, and their calculation behavior are configuration, maintained outside application feature code, for example in `@greendex/config`.
- When a Partner-side Project Coordinator first saves a Participant Journey for a Project, the system copies the complete current rules and rates into an immutable Project-owned historical snapshot in the same operation. It is an intentional historical copy, not a live reference to configuration.
- Changing configuration later affects only new Project snapshots. Existing Projects and their Claims continue to calculate from their copied rules and rates.
- For each Claim, the system derives a funding entitlement for every covered Participant from that Participant's Participant Journey and its Project's copied rules and rates.
- The travel category follows the retained clickdummy rule using approved Travel Cost Entries allocated to that Participant:
  - one or more approved entries using plane means **standard** travel;
  - no approved entry using plane means **green** travel.
- The Claim's calculated payable amount is the lower of:
  1. the total approved cost represented by its Cost Allocations; and
  2. the sum of its covered Participants' applicable funding entitlements.

For example, Robin's 850 km train journey may receive the configured green entitlement while Sam's 1,030 km plane journey receives the configured standard entitlement, even when both are included in one Claim by the same Partner Organization.

## Considered options

### One distance on the Project Partnership

Rejected because it assumes all Participants represented by one Partner Organization begin the same journey. This is false in normal use and produces wrong funding limits.

### Route and distance on each Travel Cost Entry

Rejected because a Travel Cost Entry records money and evidence and may cover several Participants. It cannot be the universal owner of each covered Participant's personal journey.

### Hard-code the distance bands and rates

Rejected because funding rules change and are policy data, not a permanent feature-code constant.

### Keep only a live reference to configuration

Rejected because a later rate change would alter the result for an existing Project. A Project must retain an immutable copy of the exact rules and rates that applied when they were first used.

### Limit reimbursement only by approved receipts

Rejected because it removes the funding-programme maximum retained from the clickdummy's required workflow.

## Consequences

- ADR-0003's independence between Cost Tracker costs and Calculator journey data is superseded. The applications will share Participant Journey identity and data, while retaining separate cost and carbon-calculation responsibilities.
- The future schema needs Participant Journey persistence linked to Project Participation.
- The Cost Tracker Claim model must calculate funding from per-Participant journeys and must never add a Partner-Organization distance column.
- The future schema needs immutable Project-owned historical rule and rate snapshot data, copied from configuration when the first Participant Journey is saved. Supporting several journeys for one Participant in one Project is deferred beyond the MVP.
