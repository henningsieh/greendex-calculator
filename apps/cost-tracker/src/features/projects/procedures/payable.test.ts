import { describe, expect, it } from "vitest";

import { derivePayable } from "@/features/projects/procedures/payable";

const bands = [
  { minKm: "500.00", maxKm: "999.00", standardEur: "309.00", greenEur: "417.00" },
  {
    minKm: "1000.00",
    maxKm: "1999.00",
    standardEur: "400.00",
    greenEur: "500.00",
  },
];
const journeys = [
  { participantId: "robin", distanceKm: "850.25" },
  { participantId: "sam", distanceKm: "1030.00" },
];
const entries = (train: string, plane: string) => [
  {
    amountEur: train,
    transportProfile: "train",
    participantIds: ["robin", "sam"],
  },
  { amountEur: plane, transportProfile: "plane", participantIds: ["sam"] },
];

// Robin is green (417), Sam standard (400), even though both share a train entry.
describe("derivePayable", () => {
  it("caps costs above the sum of per-Participant entitlements", () => {
    expect(derivePayable(entries("800.01", "200.00"), journeys, bands)).toBe(
      "817.00",
    );
  });

  it("pays exact approved allocated costs below the cap", () => {
    expect(derivePayable(entries("300.01", "200.00"), journeys, bands)).toBe(
      "500.01",
    );
  });

  it("treats a plane entry allocated to Robin as standard only for Robin", () => {
    expect(
      derivePayable(
        [
          {
            amountEur: "999.99",
            transportProfile: "plane",
            participantIds: ["robin"],
          },
          {
            amountEur: "999.99",
            transportProfile: "train",
            participantIds: ["sam"],
          },
        ],
        journeys,
        bands,
      ),
    ).toBe("809.00");
  });
});
