# Claim Workflow

Status: recommended MVP target derived from the clickdummy's use cases and the accepted Cost Tracker ADRs. This document intentionally replaces the clickdummy's manual Project phases and per-`Ticket` decisions with Claim-owned states and Cost Tracker's canonical terms.

[ADR-0027](../../../docs/adr/0027-archive-settled-cost-tracker-projects.md) records the archive decision. [Master spec #414](https://github.com/henningsieh/greendex-calculator/issues/414) includes the full Claim transition table; [#418](https://github.com/henningsieh/greendex-calculator/issues/418) covers Claim naming and [#416](https://github.com/henningsieh/greendex-calculator/issues/416) covers archive availability.

## Actors

- **Partner-side Project Coordinator** prepares, corrects, and submits its Project Partnership's Claim. Participants do not create, edit, or submit Claim data.
- **Hosting Organization Owner**, **Organization Admin**, and a **Hosting-side Project Coordinator** assigned to that Project review, approve, reject, reopen, and mark Claims paid.

## Claim lifecycle

See the [generated Claim lifecycle](claim-lifecycle.generated.md) for the allowed transitions.

Opening Claim UI persists nothing; there is no separate start ceremony. “Erstattungsantrag erstellen” / “Create claim” creates the Claim after the Project Partnership has selected a Payout Account. Its initial status is `in_preparation` (“In Vorbereitung” / “In preparation”), not a Project-wide phase or a synonym for every editable Claim. A submitted Claim is locked. Browser Back/Forward restoration revalidates the Claim's saved state and history rather than trusting a pre-submission snapshot; reload also preserves the lock. Only a correction request unlocks Partner-side editing. Reopening a rejection does not unlock Partner-side editing; Hosting staff either review it again or issue a correction request.

There is no manually opened or closed Project-wide Claim phase. While the Cost Tracker Project is active, a Partner-side Project Coordinator may prepare its Claim whenever its Project Partnership is set up and has selected a Payout Account.

## Submission checklist

The system blocks submission until all of these are true:

1. The Project Partnership has a selected Payout Account.
2. The Claim has at least one Travel Cost Entry.
3. Every Travel Cost Entry has a configured transport choice, a positive exact EUR amount, and valid Cost Allocations whose exact shares total that entry amount.
4. Every Travel Cost Entry is supported by at least one Proof Document belonging to the Claim.
5. Every covered Project Participation belongs to the Claim's Project Partnership and has its one required Participant Journey.
6. Every Participant Journey has origin, destination, trip type, and the manually entered Erasmus Distance-Calculator distance.
7. All relationship, exact-money, and funding-rule validations pass.

The Project's immutable copied rates and rules are created in the same transaction as its first saved Participant Journey. The estimated reimbursement is derived; the Partner-side Project Coordinator never enters it manually. It is stored on the Claim at submission and becomes the approved amount on approval; only a Claim in preparation has no amount.

## Review and decision

Hosting staff review the submitted Claim as one funding request. A fixable problem produces a Claim-level correction request with a required reason. The Partner-side Project Coordinator corrects its own data and resubmits.

When correct, Hosting staff approve the derived estimated reimbursement:

```text
estimated reimbursement = lower of
- approved allocated costs; and
- covered Participants' combined funding entitlements
```

A Participant's entitlement comes from that Participant's Participant Journey and the Project's copied distance-band rules and rates. Any approved allocated plane Travel Cost Entry makes that Participant standard travel; otherwise it is green travel.

A Claim may be rejected only by the defined Hosting-side roles, with a reason. It cannot be paid. Those roles may reopen an unpaid rejection if their decision was mistaken.

## Payment

See the [generated confirmation workflow](payment-confirmation.generated.md). Cancelling before confirmation changes nothing. A failed request keeps the confirmation and any entered reason available for retry.

Approval and payment are separate. Cost Tracker records one full bank transfer:

- an approved Claim begins unpaid;
- authorized Hosting staff mark it paid only after sending one transfer equal to the approved amount;
- no partial or multiple payments exist;
- a failed transfer that sent no money leaves it unpaid.

If staff accidentally mark a Claim paid without a transfer, an authorized Hosting-side role may correct the flag back to unpaid with a required reason. This is a record correction, not a banking reversal; both actions remain in Claim history.

Recording the full payment also writes one persistent notification for each responsible user of the Partner Organization side (assigned Partner coordinators plus Owners and Admins), in the same transaction as the status and history change. Repeating the confirmed payment creates no second notification. Live delivery is best-effort after commit; failures never roll the payment back, and the persisted notifications remain the source of truth for offline catch-up.

## History and access

Claim history is append-only. It records Participant Journey updates (`journey_updated`), submission, correction request and reason, resubmission, approval, rejection and reason, reopening, paid marking, and paid-flag correction, including responsible User and time.

A Payout Account is selected by Project Partnership reference. It may be changed while the Claim is editable. Once a Claim is submitted, its selected Payout Account is locked until Hosting staff return the Claim for correction; an approved or paid Claim's account cannot change. This preserves the agreed reference model without copying bank details into the Claim.

## Project readiness and archive

Project-wide progress is derived from its Project Partnerships and Claims; there are no manual preparation, claim, or review phases. A Project may have multiple Project Partnerships, each with at most one Claim. Paid or rejected Claims are settled without an additional close action; approval alone does not settle a Claim.

Archive replaces the separate Project-completion action. A Hosting Organization Owner, Organization Admin, or explicitly assigned Hosting-side Project Coordinator may archive only when every Project Partnership has a settled Claim. A Partnership without a Claim blocks archive; a Project with no Partnerships may be archived because nothing remains to settle.

Archive changes no Claim status but makes the Project read-only through Cost Tracker. Payment-status correction and reopening an individual rejection require the Project to be active. A distinct Project `reopen` permission, granted by default only to Hosting Organization Owners and Admins, permits reopening with a required reason; it does not itself reopen or change any Claim. Archive/reopen events retain actor/time/history. See [domain behavior](domain-behavior.md#cost-tracker-archive-and-reopening) for scope and UI consequences.

## Deferred beyond MVP

- More than one Participant Journey for one Project Participation.
- Partial or multiple payments.
- Bank or accounting-system integration.
- A banking reversal model.
- Configuring funding rules through an administrative UI; source configuration in `@greendex/config` is sufficient.
