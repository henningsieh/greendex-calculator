---
status: accepted
---

# Own the Claim Lifecycle Once: One Lock Order, Shared Capabilities

> Recording correction: capability wording now reflects the original shared client/server
> requirement, as corrected in ADR-0014; the lifecycle and locking decisions are unchanged.

## Decision

**1. One shared locking rule for every Claim-affecting write.** All procedures that change
Claim data — journeys, costs, Proof Documents, the Claim draft, payout selection, submission,
and every Hosting decision — take their row locks in one shared order, Project → Partnership →
Claim. `procedures/claim-locks.ts` already expresses that order and exists to prevent
concurrent writes from racing; it becomes the only way those rows are locked.

**2. Client and server use the same permission and lifecycle rules.** No screen maintains
an independent status-to-action rule. It uses supported Better Auth client checks and shared
business rules with the required context. The server independently enforces those rules
against authoritative state. Server-computed capabilities may supplement client checks,
but do not replace them. This is the same rule ADR-0014 sets for Participant surfaces.

**3. Partner editing rights follow one rule, matching the clickdummy.** While a Claim is **not
yet submitted**, a Partner may **add and correct** journeys, Travel Cost Entries and Proof
Documents alike. Once submitted, Partner editing is **locked**; a Hosting correction request
reopens it. An approved, rejected or paid Claim is closed.

## Why

The lifecycle was implemented three times over: as a pure predicate
(`isPartnerEditLocked`), as hand-applied locking at 24 sites across 10 files, and as the
Claim screen's own copy of which transitions are legal. Each copy can disagree with the others,
and they do.

**Locking.** The helper that establishes a safe fixed order is used by exactly two files —
`review.ts` and `payment.ts`, the Hosting decisions. The eight Partner and Hosting procedure
files that write Claim data each hand-roll their own `.for("update")` calls, in no shared order.
The order exists for a concrete reason: two transactions that take the same rows in opposite
order each hold what the other is waiting for, and the database kills one. That protection
currently applies to 2 files out of 10.

**Editing rights.** The screen and the server disagreed in _both_ directions. The screen hid
the controls for correcting an already-saved Participant Journey unless the Claim was in
`correction_requested`, while `journeys.ts` permits it whenever the Claim is `editable` — so a
Partner was blocked from something the server allowed. The clickdummy settles which is right:
`canPartnerEditClaim` grants normal editing while a Claim is unsubmitted and correction
editing only when a correction is required. The screen was the strict outlier; it is aligned to
the clickdummy and to the server.

ADR-0008 through ADR-0011 already decide the transitions themselves. This ADR does not reopen
them.

## Consequences

- 24 hand-rolled lock sites become calls to the shared helper. Each gains the shared order, and
  the deadlock the order prevents becomes structurally impossible rather than merely unlikely.
- The Claim screen stops maintaining its own status-to-action policy and uses shared rules.
  Its separate `correcting` flag goes away.
- `isPartnerEditLocked` and `lockClaimScope` both survive. Neither is disposable: the first
  holds the two-status rule, the second holds the lock order. Only the hand-written
  _application_ of them disappears.
- The lock scopes are not unified into one. Participation edits lock the Partnership, Travel
  Cost Entry edits lock the Claim, and decisions lock all three. Those differences are
  deliberate — each locks what it must protect — and are now applied in one order rather than
  many.

## Related

ADR-0008 (return Claims for correction), ADR-0009 (approve before payment), ADR-0010 (reject and
reopen), ADR-0011 (complete Claim workflow), ADR-0014 (shared client/server permission and
business rules with authoritative server enforcement).
