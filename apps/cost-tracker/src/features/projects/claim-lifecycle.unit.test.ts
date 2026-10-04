// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canCorrectPaidFlag,
  canPartnerEditClaim,
  canRecordPayment,
  claimPanelActions,
  claimReviewActions,
  claimReviewTransition,
  isClaimAwaitingReview,
  isPartnerEditLocked,
  type ClaimStatus,
} from "@/features/projects/claim-lifecycle";

const acceptedStates: ClaimStatus[] = [
  "editable",
  "submitted",
  "correction_requested",
  "approved",
  "rejected",
  "paid",
];

describe("Partner Claim editing rule", () => {
  it("adds and corrects in editable and correction_requested only", () => {
    expect(
      acceptedStates.filter((status) => canPartnerEditClaim(status)),
    ).toEqual(["editable", "correction_requested"]);
  });

  it("locks a missing Claim's own data only after one exists", () => {
    // Journeys and payout selection may be prepared before a Claim exists.
    expect(canPartnerEditClaim(null)).toBe(true);
    expect(canPartnerEditClaim(undefined)).toBe(true);
  });

  it("is the inverse used by writes that hold the Claim lock", () => {
    for (const status of acceptedStates)
      expect(isPartnerEditLocked(status)).toBe(!canPartnerEditClaim(status));
  });
});

describe("Hosting review transitions", () => {
  it("names one source, target and history event per decision", () => {
    expect(claimReviewTransition("requestCorrection")).toEqual({
      from: "submitted",
      to: "correction_requested",
      event: "correction_requested",
    });
    expect(claimReviewTransition("approve")).toEqual({
      from: "submitted",
      to: "approved",
      event: "approved",
    });
    expect(claimReviewTransition("reject")).toEqual({
      from: "submitted",
      to: "rejected",
      event: "rejected",
    });
    expect(claimReviewTransition("reopen")).toEqual({
      from: "rejected",
      to: "submitted",
      event: "reopened",
    });
    // Reopening returns the Claim to review locked; only a correction
    // request reopens Partner editing.
    expect(
      canPartnerEditClaim(claimReviewTransition("reopen").to),
    ).toBe(false);
  });

  it("permits review decisions only from their source status", () => {
    expect(claimReviewActions("submitted")).toEqual([
      "requestCorrection",
      "approve",
      "reject",
    ]);
    expect(claimReviewActions("rejected")).toEqual(["reopen"]);
    for (const status of [
      "editable",
      "correction_requested",
      "approved",
      "paid",
    ] as const)
      expect(claimReviewActions(status)).toEqual([]);
    expect(claimReviewActions(null)).toEqual([]);
  });
});

describe("payment recording", () => {
  it("records the one full transfer only after approval", () => {
    expect(canRecordPayment("approved")).toBe(true);
    // The paid repeat covers the idempotent retry of the same confirmed
    // transfer only; every other status refuses payment.
    expect(canRecordPayment("paid")).toBe(true);
    for (const status of [
      "editable",
      "submitted",
      "correction_requested",
      "rejected",
    ] as const)
      expect(canRecordPayment(status)).toBe(false);
  });

  it("corrects the paid flag only while paid", () => {
    expect(canCorrectPaidFlag("paid")).toBe(true);
    for (const status of [
      "editable",
      "submitted",
      "correction_requested",
      "approved",
      "rejected",
    ] as const)
      expect(canCorrectPaidFlag(status)).toBe(false);
  });
});

describe("review surfaces", () => {
  it("offers every permitted decision once and nothing else", () => {
    expect(claimPanelActions("submitted")).toEqual([
      "requestCorrection",
      "approve",
      "reject",
    ]);
    expect(claimPanelActions("rejected")).toEqual(["reopen"]);
    // Approval-before-payment: an approved Claim offers payment, never a
    // second review decision; a paid Claim offers only the flag correction.
    expect(claimPanelActions("approved")).toEqual(["markPaid"]);
    expect(claimPanelActions("paid")).toEqual(["correctPayment"]);
    expect(claimPanelActions("editable")).toEqual([]);
    expect(claimPanelActions("correction_requested")).toEqual([]);
    expect(claimPanelActions(null)).toEqual([]);
  });

  it("queues submitted Claims for review and nothing else", () => {
    expect(isClaimAwaitingReview("submitted")).toBe(true);
    for (const status of [
      "editable",
      "correction_requested",
      "approved",
      "rejected",
      "paid",
    ] as const)
      expect(isClaimAwaitingReview(status)).toBe(false);
    expect(isClaimAwaitingReview(null)).toBe(false);
  });
});
