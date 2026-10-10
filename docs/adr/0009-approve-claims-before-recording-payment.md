---
status: accepted
---

# Approve Claims Before Recording Payment

Claim approval and payment are separate auditable events. Approval confirms the amount owed; payment records that money was actually sent.

## Context

A reviewed Claim has two independently meaningful moments:

1. Hosting Organization staff decide that the Claim is correct and approve its calculated payable amount.
2. A bank transfer is later made to the Partner Organization's selected Payout Account.

Treating approval as payment would falsely show money as sent before the transfer occurs and would lose the distinction needed for financial follow-up.

## Decision

- After review is complete, authorized Hosting Organization staff approve the Claim for its calculated payable amount.
- Approval locks the Claim. The Partner-side Project Coordinator cannot make further changes.
- A later, separate authorized action marks the Claim `paid` only when one full bank transfer equal to the approved amount is actually sent.
- In the MVP, `paid` is a binary flag: an approved Claim is either unpaid or paid. It supports neither partial nor several payments.
- A failed transfer that sends no money does not change the paid flag; staff may try the transfer again.
- Claim history retains approval and the paid action as distinct events with their responsible User and time.

For example, approved costs of €800 and a funding cap of €726 produce a €726 approval. The Claim is not paid until a later full €726 bank transfer is sent and an authorized user marks it paid.

## Considered options

### Treat approval as payment

Rejected because approval means “we owe this amount,” while payment means “the money was sent.” Combining them gives inaccurate financial status whenever transfer happens later.

## Consequences

- Future Claim persistence needs distinct approval state/history and a binary paid flag with payment history data.
- The Claim review UI must distinguish an approved unpaid Claim from a paid Claim.
- Partial payments, several payments, payment reversals, and final rejection remain deferred decisions.
