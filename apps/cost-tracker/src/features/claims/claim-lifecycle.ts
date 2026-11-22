import type { claimStatusEnum } from "@greendex/database/schema";

/** The accepted Claim lifecycle states. */
export type ClaimStatus = (typeof claimStatusEnum.enumValues)[number];

/** Shared validation and form limit for Claim review/payment correction reasons. */
export const MAX_CLAIM_REASON_LENGTH = 2_000;

export const claimTransitions = {
  create: { from: null, to: "in_preparation", guard: "payoutAccount" },
  submit: { from: "in_preparation", to: "submitted", guard: "submissionReady" },
  resubmit: {
    from: "correction_requested",
    to: "submitted",
    guard: "submissionReady",
  },
  requestCorrection: {
    from: "submitted",
    to: "correction_requested",
    guard: "reason",
    event: "correction_requested",
  },
  approve: { from: "submitted", to: "approved", guard: null, event: "approved" },
  reject: {
    from: "submitted",
    to: "rejected",
    guard: "reason",
    event: "rejected",
  },
  reopen: { from: "rejected", to: "submitted", guard: null, event: "reopened" },
  markPaid: { from: "approved", to: "paid", guard: "fullPayment" },
  correctPayment: { from: "paid", to: "approved", guard: "reason" },
} as const satisfies Record<
  string,
  {
    from: ClaimStatus | null;
    to: ClaimStatus;
    guard: "payoutAccount" | "submissionReady" | "reason" | "fullPayment" | null;
    event?: string;
  }
>;

export type ClaimAction = keyof typeof claimTransitions;
export type ClaimGuard = Exclude<
  (typeof claimTransitions)[ClaimAction]["guard"],
  null
>;

export function evaluateClaimTransition<Action extends ClaimAction>(
  state: ClaimStatus | null,
  action: Action,
  facts: Partial<Record<ClaimGuard, boolean>>,
):
  | { kind: "transition"; state: (typeof claimTransitions)[Action]["to"] }
  | { kind: "refused"; reason: "invalidState" | ClaimGuard } {
  const transition = claimTransitions[action];
  if (transition.from !== state)
    return { kind: "refused", reason: "invalidState" };
  if (transition.guard && !facts[transition.guard])
    return { kind: "refused", reason: transition.guard };
  return { kind: "transition", state: transition.to };
}

export function claimSubmissionAction(status: ClaimStatus | null) {
  if (claimTransitions.submit.from === status) return "submit";
  if (claimTransitions.resubmit.from === status) return "resubmit";
  return null;
}

export function canCreateClaim(
  status: ClaimStatus | null,
  payoutAccount: boolean,
) {
  return (
    evaluateClaimTransition(status, "create", { payoutAccount }).kind ===
    "transition"
  );
}

/** States in which a Partner may add and correct Claim data. */
const partnerEditableStatuses: readonly ClaimStatus[] = [
  "in_preparation",
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
export type ClaimReviewDecision =
  | "requestCorrection"
  | "approve"
  | "reject"
  | "reopen";
const claimReviewDecisions: readonly ClaimReviewDecision[] = [
  "requestCorrection",
  "approve",
  "reject",
  "reopen",
];

export function claimReviewTransition(decision: ClaimReviewDecision) {
  const { from, to, event } = claimTransitions[decision];
  return { from, to, event };
}

/** Review decisions a Claim status permits, in panel order. */
export function claimReviewActions(
  status: ClaimStatus | null | undefined,
): readonly ClaimReviewDecision[] {
  return claimReviewDecisions.filter(
    (decision) => claimTransitions[decision].from === status,
  );
}

/**
 * Approval-before-payment (ADR-0009): only an approved Claim records its one
 * full transfer. `paid` covers solely the idempotent repeat of the same
 * confirmed transfer; amount equality stays enforced at the write.
 */
export function canRecordPayment(status: ClaimStatus): boolean {
  return (
    evaluateClaimTransition(status, "markPaid", { fullPayment: true }).kind ===
      "transition" || status === "paid"
  );
}

/**
 * Paid-flag correction (ADR-0011): only a paid Claim returns to approved with
 * a required reason. This corrects the application flag, not a bank transfer.
 */
export function canCorrectPaidFlag(status: ClaimStatus): boolean {
  return (
    evaluateClaimTransition(status, "correctPayment", { reason: true }).kind ===
    "transition"
  );
}

/** Every decision the review panel may offer, derived from the shared rules. */
export type ClaimPanelAction =
  | ClaimReviewDecision
  | "markPaid"
  | "correctPayment";

export function claimPanelActions(
  status: ClaimStatus | null | undefined,
): readonly ClaimPanelAction[] {
  if (!status) return [];
  // markPaid is offered only for the approved transition source; a paid Claim
  // offers the paid-flag correction instead, never a second payment.
  return [
    ...claimReviewActions(status),
    ...(claimTransitions.markPaid.from === status ? (["markPaid"] as const) : []),
    ...(claimTransitions.correctPayment.from === status
      ? (["correctPayment"] as const)
      : []),
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

/**
 * Whether the review page can render this Claim. An unsubmitted draft belongs
 * to the Partner; every status from submission onwards is reviewable (terminal
 * ones read-only). `claims.getReviewDetails` enforces the same rule.
 */
export function isClaimReviewable(
  status: ClaimStatus | null | undefined,
): boolean {
  return status != null && status !== "in_preparation";
}

/**
 * The one settled-status rule (ADR-0011): a Claim is settled when it is either
 * paid or rejected. A correction-requested Claim is still unsettled, as is an
 * approved Claim awaiting payment.
 */
export const settledClaimStatuses = [
  "paid",
  "rejected",
] as const satisfies readonly ClaimStatus[];

export function isSettledClaimStatus(
  status: ClaimStatus | null | undefined,
): boolean {
  return (
    status != null &&
    (settledClaimStatuses as readonly ClaimStatus[]).includes(status)
  );
}
