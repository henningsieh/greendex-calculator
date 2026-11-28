/* eslint-disable import/no-relative-parent-imports -- Unit-cover the seed ledger check next to the seed implementation. */
import { describe, expect, it } from "vitest";

import { checkLedgerConsistency } from "../../scripts/seed-showcase-lifecycle";

const bands = [
  {
    minKm: "500.00",
    maxKm: "1999.00",
    standardEur: "309.00",
    greenEur: "417.00",
  },
];

function ledger(amountEur = "250.00") {
  return {
    claimId: "synthetic",
    entryRows: [{ id: "e1", amountEur, transportProfile: "train" }],
    shares: [{ travelCostEntryId: "e1", projectParticipantId: "p1" }],
    journeyRows: [{ participantId: "p1", distanceKm: "850.25" }],
    bandRows: bands,
    profiles: ["train"],
  };
}

describe("showcase ledger consistency (synthetic)", () => {
  it("passes a consistent submitted ledger", () => {
    expect(checkLedgerConsistency("submitted", "250.00", ledger())).toEqual({
      expected: "250.00",
    });
  });

  it("flags a planted amount mismatch", () => {
    const result = checkLedgerConsistency("paid", "600.00", ledger("250.00"));
    expect(result.expected).toBe("250.00");
    expect(result.problem).toMatch(/disagrees/i);
  });

  it("flags an amount without supporting entries as never legitimate", () => {
    const empty = { ...ledger(), entryRows: [], shares: [] };
    const result = checkLedgerConsistency("paid", "600.00", empty);
    expect(result.problem).toMatch(/never legitimate/i);
  });

  it("accepts an empty in_preparation draft and rejects one carrying an amount", () => {
    const empty = { ...ledger(), entryRows: [], shares: [] };
    expect(checkLedgerConsistency("in_preparation", null, empty)).toEqual({
      expected: null,
    });
    expect(
      checkLedgerConsistency("in_preparation", "120.00", ledger("120.00"))
        .problem,
    ).toMatch(/must not carry/i);
  });
});
