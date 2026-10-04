import type { claimStatusEnum } from "@greendex/database/schema";

/** The accepted Claim lifecycle states. */
export type ClaimStatus = (typeof claimStatusEnum.enumValues)[number];

/** States in which a Partner may add and correct Claim data. */
const partnerEditableStatuses: readonly ClaimStatus[] = [
  "editable",
  "correction_requested",
];

/**
 * The one Partner Claim editing rule (ADR-0017). While a Claim is not yet
 * submitted a Partner may add and correct journeys, Travel Cost Entries, Proof
 * Documents and the selected Payout Account alike; a correction request reopens
 * all of it, while a submitted Claim stays locked and an approved, rejected or
 * paid Claim is closed. A Project Partnership without a Claim is editable.
 *
 * Procedures evaluate it against the locked Claim row; screens evaluate it with
 * the status the server authorized, to decide what to render. Neither side keeps
 * its own status-to-action rule (ADR-0014). The same holds for the Hosting
 * review, payment and submission transitions below: one table owns them.
 */
export function canPartnerEditClaim(
  status: ClaimStatus | null | undefined,
): boolean {
  return !status || partnerEditableStatuses.includes(status);
}

/** Refusal form of the same rule, for writes that already hold the Claim lock. */
export function isPartnerEditLocked(status: ClaimStatus): boolean {
  return !canPartnerEditClaim(status);
}

/**
 * The one Hosting review transition table (ADR-0008, ADR-0010, ADR-0011). Each
 * decision names its required source status, its target status and its history
 * event. Procedures enforce it against the locked Claim row; screens derive
 * every review control from it. Neither side keeps its own status-to-action
 * rule (ADR-0014, ADR-0017).
 */
const claimReviewTransitions = {
  requestCorrection: {
    from: "submitted",
    to: "correction_requested",
    event: "correction_requested",
  },
  approve: { from: "submitted", to: "approved", event: "approved" },
  reject: { from: "submitted", to: "rejected", event: "rejected" },
  reopen: { from: "rejected", to: "submitted", event: "reopened" },
} as const satisfies Record<
  string,
  {
    from: ClaimStatus;
    to: ClaimStatus;
    event: "correction_requested" | "approved" | "rejected" | "reopened";
  }
>;

export type ClaimReviewDecision = keyof typeof claimReviewTransitions;

export function claimReviewTransition(decision: ClaimReviewDecision) {
  return claimReviewTransitions[decision];
}

/** Review decisions a Claim status permits, in panel order. */
export function claimReviewActions(
  status: ClaimStatus | null | undefined,
): readonly ClaimReviewDecision[] {
  return (Object.keys(claimReviewTransitions) as ClaimReviewDecision[]).filter(
    (decision) => claimReviewTransitions[decision].from === status,
  );
}

/**
 * Approval-before-payment (ADR-0009): only an approved Claim records its one
 * full transfer. `paid` covers solely the idempotent repeat of the same
 * confirmed transfer; amount equality stays enforced at the write.
 */
export function canRecordPayment(status: ClaimStatus): boolean {
  return status === "approved" || status === "paid";
}

/**
 * Paid-flag correction (ADR-0011): only a paid Claim returns to approved with
 * a required reason. This corrects the application flag, not a bank transfer.
 */
export function canCorrectPaidFlag(status: ClaimStatus): boolean {
  return status === "paid";
}

/** Every decision the review panel may offer, derived from the shared rules. */
export type ClaimPanelAction = ClaimReviewDecision | "markPaid" | "correctPayment";

export function claimPanelActions(
  status: ClaimStatus | null | undefined,
): readonly ClaimPanelAction[] {
  if (!status) return [];
  // markPaid is offered only for the approved transition source; a paid Claim
  // offers the paid-flag correction instead, never a second payment.
  return [
    ...claimReviewActions(status),
    ...(status === "approved" ? (["markPaid"] as const) : []),
    ...(canCorrectPaidFlag(status) ? (["correctPayment"] as const) : []),
  ];
}

/**
 * Claims awaiting Hosting review (ADR-0011): submitted only. Correction,
 * decision and payment states are never reviewable; unsubmitted drafts stay
 * invisible to review.
 */
export function isClaimAwaitingReview(
  status: ClaimStatus | null | undefined,
): boolean {
  return status === "submitted";
}
