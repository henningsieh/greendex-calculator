import type { ParticipantTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import type { projectSharedTravelLegsTable } from "@greendex/database/schema";

/** A generated travel record displayed only in the mock live view. */
export type ParticipantTravelLeg = Pick<
  typeof projectSharedTravelLegsTable.$inferSelect,
  "id" | "distanceKm"
> & {
  // Mock journeys can include plane, which the persisted table enum excludes.
  transportEmissionProfile: ParticipantTransportEmissionProfile;
  co2Kg: number;
};

/** Generated participant data displayed only in the mock live view. */
export interface LiveViewParticipant {
  id: string;
  name: string;
  country: string;
  totalCO2: number;
  participantTravelLegs: ParticipantTravelLeg[];
}

export interface LiveViewProjectStats {
  totalParticipants: number;
  totalCO2: number;
  averageCO2: number;
  breakdownByProfile: Record<
    ParticipantTransportEmissionProfile,
    {
      distance: number;
      co2: number;
      count: number;
    }
  >;
  treesNeeded: number;
}
