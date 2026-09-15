# Claim Workflow

Status: recommended MVP target derived from the clickdummy's use cases and the accepted Cost Tracker ADRs. This document intentionally replaces the clickdummy's manual Project phases and per-`Ticket` decisions with Claim-owned states and Cost Tracker's canonical terms.

## Actors

- **Partner-side Project Coordinator** prepares, corrects, and submits its Project Partnership's Claim. Participants do not create, edit, or submit Claim data.
- **Hosting Organization Owner**, **Organization Admin**, and a **Hosting-side Project Coordinator** assigned to that Project review, approve, reject, reopen, and mark Claims paid.

## Claim lifecycle

```text
editable → submitted → correction requested → submitted
                     ↘ approved → paid
                     ↘ rejected → reopened for Hosting review
```

Opening Claim UI persists nothing. The first saved Claim information creates the Claim. A submitted Claim is locked. Only a correction request unlocks Partner-side editing. Reopening a rejection does not unlock Partner-side editing; Hosting staff either review it again or issue a correction request.

There is no manually opened or closed Project-wide Claim phase. A Partner-side Project Coordinator may prepare its Claim whenever its Project Partnership is set up and has selected a Payout Account.

## Submission checklist

The system blocks submission until all of these are true:

1. The Project Partnership has a selected Payout Account.
2. The Claim has at least one Travel Cost Entry.
3. Every Travel Cost Entry has a configured transport choice, a positive exact EUR amount, and valid Cost Allocations whose exact shares total that entry amount.
4. Every Travel Cost Entry is supported by at least one Proof Document belonging to the Claim.
5. Every covered Project Participation belongs to the Claim's Project Partnership and has its one required Participant Journey.
6. Every Participant Journey has origin, destination, trip type, and the manually entered Erasmus Distance-Calculator distance.
7. All relationship, exact-money, and funding-rule validations pass.

The Project's immutable copied rates and rules are created in the same transaction as its first saved Participant Journey. The payable amount is derived; the Partner-side Project Coordinator never enters it manually.

## Review and decision

Hosting staff review the submitted Claim as one funding request. A fixable problem produces a Claim-level correction request with a required reason. The Partner-side Project Coordinator corrects its own data and resubmits.

When correct, Hosting staff approve the derived payable amount:

```text
payable amount = lower of
- approved allocated costs; and
- covered Participants' combined funding entitlements
```

A Participant's entitlement comes from that Participant's Participant Journey and the Project's copied distance-band rules and rates. Any approved allocated plane Travel Cost Entry makes that Participant standard travel; otherwise it is green travel.

A Claim may be rejected only by the defined Hosting-side roles, with a reason. It cannot be paid. Those roles may reopen an unpaid rejection if their decision was mistaken.

## Payment

Approval and payment are separate. The MVP supports one full bank transfer only:

- an approved Claim begins unpaid;
- authorized Hosting staff mark it paid only after sending one transfer equal to the approved amount;
- no partial or multiple payments exist;
- a failed transfer that sent no money leaves it unpaid.

If staff accidentally mark a Claim paid without a transfer, an authorized Hosting-side role may correct the flag back to unpaid with a required reason. This is a record correction, not a banking reversal; both actions remain in Claim history.

## History and access

Claim history is append-only. It records submission, correction request and reason, resubmission, approval, rejection and reason, reopening, paid marking, and paid-flag correction, including responsible User and time.

A Payout Account is selected by Project Partnership reference. It may be changed while the Claim is editable. Once a Claim is submitted, its selected Payout Account is locked until Hosting staff return the Claim for correction; an approved or paid Claim's account cannot change. This preserves the agreed reference model without copying bank details into the Claim.

## Project readiness and completion

Project-wide progress is derived from its Project Partnerships and Claims; there are no manual preparation, claim, or review phases. A Hosting Organization Owner, Organization Admin, or Hosting-side Project Coordinator may complete a Project only when every Project Partnership has a terminal Claim: either paid or rejected. A Project Partnership without a Claim blocks completion; staff must resolve its participation rather than silently treating it as complete.

## Deferred beyond MVP

- More than one Participant Journey for one Project Participation.
- Partial or multiple payments.
- Bank or accounting-system integration.
- A banking reversal model.
- Configuring funding rules through an administrative UI; source configuration in `@greendex/config` is sufficient.
