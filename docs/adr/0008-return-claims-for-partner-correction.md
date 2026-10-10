---
status: accepted
---

# Return Claims for Partner Correction

When authorized Hosting Organization staff find incorrect Claim data, they request correction from the Partner-side Project Coordinator. Hosting staff do not silently alter the Partner Organization's Claim amounts or supporting data.

## Context

A Claim is the Partner Organization's funding request. During review, Hosting staff may find that a Travel Cost Entry does not match its Proof Document—for example, the Claim records €500 while the document shows €450.

The system needs a clear owner for correcting that discrepancy. Letting a reviewer overwrite the Partner Organization's entered value would obscure who made the request, what was changed, and whether the Partner Organization accepts the correction.

## Decision

- An authorized Hosting Organization staff member may return a submitted Claim for correction and must supply a clear reason.
- Returning the Claim makes it editable again only for the authorized Partner-side Project Coordinator responsible for that Claim's Project Partnership.
- The Partner-side Project Coordinator corrects, removes, or otherwise updates the Claim data, then submits the Claim again for review.
- Hosting Organization staff do not change entered Travel Cost Entry amounts, Cost Allocations, Proof Documents, Participant Journeys, or payout data on the Partner Organization's behalf.
- Every correction request and subsequent resubmission is retained in Claim history with its author, time, and reason or submission event.

## Considered options

### Let Hosting staff set a separate approved amount

Rejected for the MVP because it creates claimed-versus-approved monetary data, partial-approval rules, and a more complex financial audit model before it is needed. The Partner Organization instead corrects and resubmits its own request.

### Reject only the incorrect Travel Cost Entry

Rejected because a Partner Organization needs a clear opportunity to correct a document, amount, allocation, or related journey data before that cost is excluded. A Claim-level correction request provides one coherent review loop.

## Consequences

- A submitted Claim remains locked unless it is returned for correction.
- Future Claim persistence needs a correction-request state and append-only review history.
- The review UI must show the correction reason and clearly identify the Partner-side Project Coordinator action required before resubmission.
- Approval, final rejection, payment recording, and the detailed Claim submission checklist remain separate decisions.
