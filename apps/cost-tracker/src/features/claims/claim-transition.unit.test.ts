import { describe, expect, it } from "vitest";

import { evaluateClaimTransition } from "./claim-lifecycle";

describe("Claim transitions", () => {
  it("requires the facts for creation, submission, review and payment", () => {
    expect(evaluateClaimTransition(null, "create", {})).toEqual({
      kind: "refused",
      reason: "payoutAccount",
    });
    expect(
      evaluateClaimTransition(null, "create", { payoutAccount: true }),
    ).toEqual({ kind: "transition", state: "in_preparation" });
    expect(
      evaluateClaimTransition("in_preparation", "submit", {
        submissionReady: true,
      }),
    ).toEqual({ kind: "transition", state: "submitted" });
    expect(
      evaluateClaimTransition("correction_requested", "resubmit", {
        submissionReady: false,
      }),
    ).toEqual({ kind: "refused", reason: "submissionReady" });
    expect(
      evaluateClaimTransition("correction_requested", "resubmit", {
        submissionReady: true,
      }),
    ).toEqual({ kind: "transition", state: "submitted" });
    expect(
      evaluateClaimTransition("submitted", "requestCorrection", { reason: true }),
    ).toEqual({ kind: "transition", state: "correction_requested" });
    expect(evaluateClaimTransition("submitted", "approve", {})).toEqual({
      kind: "transition",
      state: "approved",
    });
    expect(
      evaluateClaimTransition("submitted", "reject", { reason: false }),
    ).toEqual({ kind: "refused", reason: "reason" });
    expect(
      evaluateClaimTransition("submitted", "reject", { reason: true }),
    ).toEqual({ kind: "transition", state: "rejected" });
    expect(evaluateClaimTransition("rejected", "reopen", {})).toEqual({
      kind: "transition",
      state: "submitted",
    });
    expect(
      evaluateClaimTransition("approved", "markPaid", { fullPayment: false }),
    ).toEqual({ kind: "refused", reason: "fullPayment" });
    expect(
      evaluateClaimTransition("approved", "markPaid", { fullPayment: true }),
    ).toEqual({ kind: "transition", state: "paid" });
    expect(
      evaluateClaimTransition("paid", "correctPayment", { reason: true }),
    ).toEqual({ kind: "transition", state: "approved" });
    expect(
      evaluateClaimTransition("rejected", "submit", { submissionReady: true }),
    ).toEqual({ kind: "refused", reason: "invalidState" });
  });
});
