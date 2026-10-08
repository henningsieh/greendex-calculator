import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "./transport-emission-profiles";

/** Clickdummy EUR rates, versioned so a Project can copy the entire rule set at first use. */
export const TRAVEL_FUNDING_RULES = {
  version: 1,
  participantTransportProfiles: PARTICIPANT_TRANSPORT_EMISSION_PROFILES,
  bands: [
    { minKm: 10, maxKm: 99, standardEur: 28, greenEur: 56 },
    { minKm: 100, maxKm: 499, standardEur: 211, greenEur: 285 },
    { minKm: 500, maxKm: 1999, standardEur: 309, greenEur: 417 },
    { minKm: 2000, maxKm: 2999, standardEur: 395, greenEur: 535 },
    { minKm: 3000, maxKm: 3999, standardEur: 580, greenEur: 785 },
  ],
} as const;

export type TravelFundingBand = (typeof TRAVEL_FUNDING_RULES.bands)[number];

/** Returns null for distances outside the configured bands (including non-finite values). */
export function getTravelFundingRate(
  distanceKm: number,
): TravelFundingBand | null {
  return (
    TRAVEL_FUNDING_RULES.bands.find(
      (band) => distanceKm >= band.minKm && distanceKm <= band.maxKm,
    ) ?? null
  );
}
