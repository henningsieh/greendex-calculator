import {
  ACCOMMODATION_DATA,
  FOOD_DATA,
  type ACCOMMODATION_VALUES,
  type CAR_TYPE_VALUES,
  type ELECTRICITY_VALUES,
  type FOOD_VALUES,
  type GENDER_VALUES,
  type ROOM_OCCUPANCY_VALUES,
} from "@greendex/config/participate";
import type { ParticipantTransportEmissionProfile } from "@greendex/config/transport-emission-profiles";
import type { projectSharedTravelLegsTable } from "@greendex/database/schema";
import type { z } from "zod";

import type { ParticipantSchema } from "@/features/participants/validation-schemas";
import type { ProjectForParticipationType } from "@/features/projects/types";

// ============================================================================
// PARTICIPATE ANSWER TYPES
// ============================================================================

/**
 * Accommodation category types inferred from configuration
 */
export type AccommodationCategory = (typeof ACCOMMODATION_VALUES)[number];

/**
 * Room occupancy types
 */
export type RoomOccupancy = (typeof ROOM_OCCUPANCY_VALUES)[number];

/**
 * Electricity type used in accommodation
 */
export type ElectricityType = (typeof ELECTRICITY_VALUES)[number];

/**
 * Food frequency (meat consumption)
 */
export type FoodFrequency = (typeof FOOD_VALUES)[number];

/**
 * Car type for transportation
 */
export type CarType = (typeof CAR_TYPE_VALUES)[number];

/**
 * Gender options for participant demographics
 */
export type Gender = (typeof GENDER_VALUES)[number];

/**
 * Complete participant answers interface for questionnaire
 */
export interface ParticipantAnswers {
  // Step 0: Participant Info
  firstName: string;
  country: string;
  email: string;

  // Step 1: Days
  days: number;

  // Step 2: Accommodation category
  accommodationCategory: AccommodationCategory;

  // Step 3: Room occupancy
  roomOccupancy: RoomOccupancy;

  // Step 4: Electricity
  electricity: ElectricityType;

  // Step 5: Food
  food: FoodFrequency;

  // Step 6: Flight km TO project
  flightKm: number;

  // Step 7: Boat km TO project
  boatKm: number;

  // Step 8: Train km TO project
  trainKm: number;

  // Step 9: Bus km TO project
  busKm: number;

  // Step 10: Car km TO project
  carKm: number;

  // Step 11: Car type (conditional on carKm > 0)
  carType?: CarType;

  // Step 12: Car passengers (conditional on carKm > 0)
  carPassengers?: number;

  // Step 13: Age
  age: number;

  // Step 14: Gender
  gender: Gender;
}

// ============================================================================
// EMISSION CALCULATION TYPES
// ============================================================================

/**
 * Emission calculation result with breakdown by category
 */
export interface EmissionCalculation {
  participantTravelCO2: number;
  projectSharedTravelCO2: number;
  accommodationCO2: number;
  foodCO2: number;
  totalCO2: number;
  treesNeeded: number;
}

/**
 * Accommodation CO₂ factors (kg CO₂ per night per person)
 * Inferred from configuration data
 */
export const ACCOMMODATION_FACTORS: Record<AccommodationCategory, number> =
  Object.fromEntries(ACCOMMODATION_DATA) as Record<AccommodationCategory, number>;

/**
 * Food CO₂ factors (kg CO₂ per day)
 * Inferred from configuration data
 */
export const FOOD_FACTORS: Record<FoodFrequency, number> = Object.fromEntries(
  FOOD_DATA,
) as Record<FoodFrequency, number>;

/**
 * Re-export Project type for use in questionnaire components
 */
export type Project = ProjectForParticipationType;

// ============================================================================
// PARTICIPANT TRAVEL LEG TYPES
// ============================================================================

/**
 * Participant Travel Leg transport-emission profile from shared configuration.
 */
export type ParticipantTravelLegTransportEmissionProfile =
  ParticipantTransportEmissionProfile;

/**
 * A Participant Travel Leg computed from questionnaire responses for UI display.
 * It is not persisted in the database.
 */
export type ParticipantTravelLeg = Pick<
  typeof projectSharedTravelLegsTable.$inferSelect,
  "id" | "distanceKm"
> & {
  // Participant journeys can include plane, which the persisted table enum excludes.
  transportEmissionProfile: ParticipantTravelLegTransportEmissionProfile;
  co2Kg: number;
};

// Computed fields type for participant statistics
// These are calculated on-the-fly and are not stored in the database
interface ParticipantComputedFields {
  totalCO2: number;
  rank?: number;
}

/**
 * Participant type for UI display with computed fields
 * This extends the inferred database type with calculated values
 */
export type Participant = z.infer<typeof ParticipantSchema> & {
  travelLegs: ParticipantTravelLeg[];
} & ParticipantComputedFields;

/**
 * Project statistics type - computed values only, not persisted
 * This is calculated on-the-fly from participant and activity data
 */
export interface ProjectStats {
  totalParticipants: number;
  totalCO2: number;
  averageCO2: number;
  breakdownByTransportEmissionProfile: Record<
    ParticipantTravelLegTransportEmissionProfile,
    {
      distance: number;
      co2: number;
      count: number;
    }
  >;
  treesNeeded: number; // Average tree absorbs ~22kg CO₂ per year, ~1 ton in lifetime (~45 years)
}
