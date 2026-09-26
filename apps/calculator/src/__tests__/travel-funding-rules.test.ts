import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import {
  getTravelFundingRate,
  TRAVEL_FUNDING_RULES,
} from "@greendex/config/travel-funding-rules";
import { describe, expect, it } from "vitest";

describe("Travel funding rules configuration", () => {
  it("retains the clickdummy's complete distance bands and EUR rates", () => {
    expect(TRAVEL_FUNDING_RULES).toEqual({
      version: 1,
      participantTransportProfiles: PARTICIPANT_TRANSPORT_EMISSION_PROFILES,
      bands: [
        { minKm: 10, maxKm: 99, standardEur: 28, greenEur: 56 },
        { minKm: 100, maxKm: 499, standardEur: 211, greenEur: 285 },
        { minKm: 500, maxKm: 1999, standardEur: 309, greenEur: 417 },
        { minKm: 2000, maxKm: 2999, standardEur: 395, greenEur: 535 },
        { minKm: 3000, maxKm: 3999, standardEur: 580, greenEur: 785 },
      ],
    });
  });

  it.each([
    [10, 10, 28, 56],
    [99, 10, 28, 56],
    [100, 100, 211, 285],
    [499, 100, 211, 285],
    [500, 500, 309, 417],
    [1999, 500, 309, 417],
    [2000, 2000, 395, 535],
    [2999, 2000, 395, 535],
    [3000, 3000, 580, 785],
    [3999, 3000, 580, 785],
  ])("looks up %i km", (distance, minKm, standardEur, greenEur) => {
    expect(getTravelFundingRate(distance)).toMatchObject({
      minKm,
      standardEur,
      greenEur,
    });
  });

  it.each([0, 9, 4000, -1, Number.NaN, Infinity])(
    "rejects distance %s outside the supported bands",
    (distance) => {
      expect(getTravelFundingRate(distance)).toBeNull();
    },
  );
});
