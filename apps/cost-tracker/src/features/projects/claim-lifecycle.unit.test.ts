// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canPartnerEditClaim,
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
