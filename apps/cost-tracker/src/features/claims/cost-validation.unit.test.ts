import { describe, expect, it } from "vitest";

import { CostSaveInputSchema } from "@/features/claims/cost-validation";

const base = {
  partnershipId: "partnership",
  transportProfile: "train",
  amountEur: "10.00",
  allocationMethod: "equal" as const,
  allocations: [{ projectParticipantId: "one" }, { projectParticipantId: "two" }],
};

describe("cost save validation", () => {
  it("accepts exact percentage and money totals without rounding", () => {
    expect(
      CostSaveInputSchema.safeParse({
        ...base,
        allocationMethod: "percentage",
        allocations: [
          { projectParticipantId: "one", percentage: "33.333333" },
          { projectParticipantId: "two", percentage: "66.666667" },
        ],
      }).success,
    ).toBe(true);
    expect(
      CostSaveInputSchema.safeParse({
        ...base,
        amountEur: "999999999999.99",
        allocationMethod: "amount",
        allocations: [
          { projectParticipantId: "one", amountEur: "999999999999.98" },
          { projectParticipantId: "two", amountEur: "0.01" },
        ],
      }).success,
    ).toBe(true);
  });

  it("returns stable IDs and exact paths for duplicates, mixed methods and wrong totals", () => {
    const result = CostSaveInputSchema.safeParse({
      ...base,
      allocationMethod: "amount",
      allocations: [
        { projectParticipantId: "one", amountEur: "4.00" },
        { projectParticipantId: "one", percentage: "60" },
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["allocations", 1, "projectParticipantId"],
        message: "allocationSharesInvalid",
      },
      { path: ["allocations", 1], message: "allocationSharesInvalid" },
      { path: ["allocations"], message: "allocationSharesInvalid" },
    ]);
  });

  it.each([
    [{ amountEur: "0" }, ["amountEur"], "entryAmountRequired"],
    [{ amountEur: "1.001" }, ["amountEur"], "entryAmountRequired"],
    [
      { transportProfile: "invalid" },
      ["transportProfile"],
      "transportProfileOutsideRules",
    ],
    [{ allocations: [] }, ["allocations"], "allocationRequired"],
    [
      {
        allocationMethod: "percentage",
        allocations: [{ projectParticipantId: "one", percentage: "100.000001" }],
      },
      ["allocations"],
      "allocationSharesInvalid",
    ],
    [
      {
        allocationMethod: "amount",
        allocations: [{ projectParticipantId: "one", amountEur: "0" }],
      },
      ["allocations", 0],
      "allocationSharesInvalid",
    ],
  ])("rejects invalid input %#", (patch, path, message) => {
    const result = CostSaveInputSchema.safeParse({ ...base, ...patch });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path, message })]),
    );
  });
});
