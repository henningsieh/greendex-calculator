---
status: accepted
---

# Reject and Reopen Claims

Authorized Hosting Organization staff may reject an ineligible Claim with a reason. The rejected Claim is locked and unpaid, but those Hosting-side roles may reopen it when the rejection was mistaken.

## Context

A correction request handles a Claim with fixable data: the Partner-side Project Coordinator changes its own data and resubmits. Some Claims must instead receive no money, for example because the Partner Organization is ineligible or its evidence is deliberately false.

The clickdummy preserves a rejected Claim and its reason, and lets administrators reopen an unpaid rejected Claim. That outcome is useful, but Cost Tracker needs its precise authorization and editing consequences defined.

## Decision

- Only these authorized Hosting Organization staff may reject or reopen a Claim:
  - an Organization Owner in the Project's Hosting Organization;
  - an Organization Admin in the Project's Hosting Organization; or
  - a `project-coordinator` with an explicit assignment to that hosted Project.
- Rejection requires a clear reason, locks the Claim, and makes payment impossible.
- Participants and Partner-side Project Coordinators cannot reject or reopen Claims.
- Reopening is available only to the same defined Hosting-side roles and only while the Claim remains unpaid.
- Reopening returns the Claim to Hosting-side review while keeping it locked to the Partner-side Project Coordinator. If Partner data needs changing, Hosting staff must issue a correction request; reopening is not an editing shortcut.
- Rejection and reopening are retained in Claim history with their responsible User, time, and reason where applicable.

## Considered options

### Use correction requests for every problem

Rejected because some Claims must receive no money rather than receive another ordinary correction cycle.

### Make rejection irreversible

Rejected because a Hosting-side decision can itself be mistaken. Reopening the unpaid Claim preserves its history and permits a proper new review.

## Consequences

- Future Claim persistence needs distinct submitted-for-review, correction-requested, approved, rejected, and paid states or equivalent audited transitions.
- The Claim UI must make the rejection reason visible and distinguish a rejected Claim from a correction request.
- Reopening a rejected Claim does not authorize Partner-side editing by itself.
