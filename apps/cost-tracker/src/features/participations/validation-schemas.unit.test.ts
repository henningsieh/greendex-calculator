import { describe, expect, it } from "vitest";

import { JourneyInputSchema } from "@/features/participations/validation-schemas";

const valid = {
  partnershipId: " partnership ",
  projectParticipantId: " participant ",
  origin: " Berlin ",
  destination: " Riga ",
  tripType: "round-trip",
  erasmusDistanceKm: "850.25",
};

describe("Journey input", () => {
  it("trims identifiers and locations while preserving the exact distance", () => {
    expect(JourneyInputSchema.parse(valid)).toEqual({
      partnershipId: "partnership",
      projectParticipantId: "participant",
      origin: "Berlin",
      destination: "Riga",
      tripType: "round-trip",
      erasmusDistanceKm: "850.25",
    });
  });

  it.each([
    ["origin", "", "journeyOriginRequired"],
    ["destination", undefined, "journeyDestinationRequired"],
    ["tripType", "invalid", "journeyTripTypeRequired"],
    ["erasmusDistanceKm", "0", "journeyDistanceRequired"],
    ["erasmusDistanceKm", "1.234", "journeyDistanceRequired"],
  ])("returns a semantic message for %s", (field, value, id) => {
    const result = JourneyInputSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.message)).toEqual([id]);
  });

  it.each([
    ["partnershipId", " "],
    ["projectParticipantId", ""],
    ["origin", "  "],
    ["destination", ""],
    ["tripType", "other"],
    ["erasmusDistanceKm", "0"],
    ["erasmusDistanceKm", "1.234"],
    ["erasmusDistanceKm", "10000000000"],
    ["erasmusDistanceKm", " 1"],
  ])("rejects invalid %s value %j", (field, value) => {
    expect(
      JourneyInputSchema.safeParse({ ...valid, [field]: value }).success,
    ).toBe(false);
  });

  it.each(["0.01", "9999999999.99", "1", "1.2"])(
    "accepts exact positive distance %s",
    (distance) => {
      expect(
        JourneyInputSchema.safeParse({ ...valid, erasmusDistanceKm: distance })
          .success,
      ).toBe(true);
    },
  );
});
