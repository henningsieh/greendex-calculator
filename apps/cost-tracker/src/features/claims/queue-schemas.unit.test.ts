import { describe, expect, it } from "vitest";

import { ClaimQueueRowSchema } from "@/features/claims/queue-schemas";

const row = {
  partnershipId: "partnership",
  projectId: "project",
  projectName: "Project",
  organizationId: "partner",
  organizationName: "Partner",
  status: "submitted" as const,
  submittedAt: new Date("2026-11-01T00:00:00.000Z"),
  payableAmountEur: "100.00",
};

describe("Claim queue row", () => {
  it("accepts a submitted Claim with its estimated reimbursement", () => {
    expect(ClaimQueueRowSchema.parse(row)).toMatchObject({
      status: "submitted",
      payableAmountEur: "100.00",
    });
  });

  it("rejects a submitted Claim without an amount", () => {
    // The database check owns this invariant; the queue type keeps it
    // unrepresentable past the procedure boundary as well.
    expect(
      ClaimQueueRowSchema.safeParse({ ...row, payableAmountEur: null }).success,
    ).toBe(false);
  });
});
