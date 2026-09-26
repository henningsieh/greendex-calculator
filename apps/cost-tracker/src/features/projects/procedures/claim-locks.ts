/** A correction request reopens all Partner-side edits, including the selected payout account. */
export function claimLocksPartnerEdits(status: string): boolean {
  return status !== "editable" && status !== "correction_requested";
}
