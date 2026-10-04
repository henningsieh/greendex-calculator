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
 * its own status-to-action rule (ADR-0014).
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