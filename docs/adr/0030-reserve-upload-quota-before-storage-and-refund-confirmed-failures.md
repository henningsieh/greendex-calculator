---
status: accepted
---

# Reserve upload quota before storage and refund only confirmed failures

A Partner Organization's daily Proof Document allowance is a shared PostgreSQL counter (`principal_quota_counters`, `kind = 'upload_bytes'`, `user_key = ''`). The upload path reserves bytes inside the transaction that locks the Claim and sniffs the MIME type, uploads the object after that transaction commits, and publishes the document row in a second transaction. Storage or finalization can therefore fail after the Organization has been charged. Before #387 the charge stayed even when no document row existed, so a transient storage or database error consumed allowance for bytes that were never persisted. The compensating path could also tell a failed upload apart from an ambiguous commit only by checking whether the document row exists.

## Decision

- `consume` and `consumeUploadBytes` return the counter `window_start` they charged together with the outcome (`allowed` / `exhausted`), so a later refund is bound to the exact UTC day that was charged rather than to the day the failure is handled.
- `refundUploadBytes(tx, { partnerOrganizationId, bytes, windowStart })` is one atomic statement:

  ```sql
  update principal_quota_counters set used = greatest(0, used - $bytes)
  where kind = 'upload_bytes' and organization_id = $organizationId
    and user_key = '' and window_start = $windowStart
  ```

  The `window_start` predicate makes a rollout into a new UTC day a no-op, and `GREATEST(0, …)` keeps concurrent refunds from driving usage negative.
- The refund runs only in the compensating catch path and only after an existence query confirms that no document row references the attempted storage reference. If that existence check fails, the charge is kept: an ambiguous commit may have persisted the document, so the charge may correspond to real bytes.
- The refund is best effort. A refund failure is logged and never masks the original upload or finalization error.
- The reservation point, limits, and windows are unchanged. A persisted document that is later deleted still does not refund consumption; only a publication that definitively produced no row is reversed.

## Alternatives

- **Charge only after the document row is inserted:** rejected. The insert happens after storage returns, so concurrent uploads would pass the daily check before any bytes are recorded and could exceed the allowance together.
- **Refund against the current window instead of the reserved one:** rejected. An upload reserved before 00:00 UTC that fails after it would subtract from the new day's allowance, either blocking valid uploads or masking a real overspend.
- **Refund on every error in the catch path without checking the document row:** rejected. After an ambiguous commit the row can be live while the client sees an error; refunding then would credit bytes that were persisted.
- **Compensate by deleting the document row (the pre-#374 flow):** rejected and no longer applicable. The row is inserted only after storage succeeds, so a failed publication has no row to delete, and deleting a possibly committed row risks removing legitimate bytes.
- **Track refunds as a separate counter or ledger:** rejected as speculative. One monotonic `used` value with a window guard and a clamped decrement expresses the invariant without a second source of truth.

## Consequences

- A failed storage PUT or a failed finalization leaves the Organization's allowance at its pre-attempt value and leaves no document row.
- A refund whose reserved window has rolled over is dropped rather than credited to the new day; the old window's charge remains historical and its counter row may later be removed by expiry cleanup, which makes any late refund a no-op by the same predicate.
- During the storage call the reservation is charged while no row exists. That state is intentional and invisible to listing, linking, and submission because those read document rows.
- Tests cover storage failure, finalization failure, the per-Claim capacity race, ambiguous commits with an existing row, UTC rollover, and concurrent refunds.
