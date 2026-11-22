import { describe, expect, it } from "vitest";

import { evaluatePaymentInteraction } from "@/features/claims/payment-interaction";

const closed = { phase: "closed" } as const;
const confirming = { phase: "confirming", intent: "correctPayment" } as const;
const pending = { phase: "pending", intent: "correctPayment" } as const;
const submit = {
  type: "submit",
  permitted: true,
  hasAmount: true,
  hasReason: true,
} as const;

describe("payment interaction", () => {
  it("opens, submits, retains intent after failure, and closes on success or cancel", () => {
    expect(
      evaluatePaymentInteraction(closed, {
        type: "open",
        intent: "correctPayment",
      }),
    ).toEqual({ kind: "transition", state: confirming });
    expect(evaluatePaymentInteraction(confirming, submit)).toEqual({
      kind: "transition",
      state: pending,
    });
    expect(evaluatePaymentInteraction(pending, { type: "failure" })).toEqual({
      kind: "transition",
      state: confirming,
    });
    expect(evaluatePaymentInteraction(pending, { type: "success" })).toEqual({
      kind: "transition",
      state: closed,
    });
    expect(evaluatePaymentInteraction(confirming, { type: "cancel" })).toEqual({
      kind: "transition",
      state: closed,
    });
  });

  it("refuses invalid events and missing confirmation facts", () => {
    expect(evaluatePaymentInteraction(pending, submit)).toEqual({
      kind: "refused",
      reason: "invalidEvent",
    });
    expect(evaluatePaymentInteraction(pending, { type: "cancel" })).toEqual({
      kind: "refused",
      reason: "invalidEvent",
    });
    expect(
      evaluatePaymentInteraction(confirming, { ...submit, permitted: false }),
    ).toEqual({ kind: "refused", reason: "notPermitted" });
    expect(
      evaluatePaymentInteraction(confirming, { ...submit, hasReason: false }),
    ).toEqual({ kind: "refused", reason: "missingReason" });
    expect(
      evaluatePaymentInteraction(
        { phase: "confirming", intent: "markPaid" },
        { ...submit, hasAmount: false },
      ),
    ).toEqual({ kind: "refused", reason: "missingAmount" });
  });
});
