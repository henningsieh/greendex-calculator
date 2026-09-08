import { TRANSPORT_EMISSION_FACTORS } from "@greendex/config/transport-emission-profiles";
import { describe, expect, it } from "vitest";

import type { ProjectParticipantWithUser } from "@/features/participants/types";
import type { ProjectSharedTravelLegForCalculation } from "@/features/project-shared-travel-legs/calculations";
import {
  calculateProjectDuration,
  getProjectStatistics,
} from "@/features/projects/utils";

describe("calculateProjectDuration", () => {
  it("returns 0 for invalid dates", () => {
    expect(calculateProjectDuration("invalid", "also-invalid")).toBe(0);
  });

  it("returns 0 when end is before start", () => {
    const start = new Date("2025-01-10");
    const end = new Date("2025-01-01");
    expect(calculateProjectDuration(start, end)).toBe(0);
  });

  it("uses ceil and returns whole days", () => {
    const start = new Date("2025-01-01T00:00:00Z");
    const end = new Date("2025-01-02T12:00:00Z");
    expect(calculateProjectDuration(start, end)).toBe(2);
  });
});

describe("getProjectStatistics", () => {
  it("computes Project Shared Travel Leg counts, distance, duration, and emissions", () => {
    const project = {
      startDate: "2025-01-01",
      endDate: "2025-01-05",
    };

    const participants: ProjectParticipantWithUser[] = [
      {
        id: "participant-1",
        projectId: "project-1",
        memberId: "member-1",
        userId: "user-1",
        country: "DE",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-1",
          name: "Participant One",
          email: "participant-1@example.com",
          image: null,
        },
      },
      {
        id: "participant-2",
        projectId: "project-1",
        memberId: "member-2",
        userId: "user-2",
        country: "DE",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-2",
          name: "Participant Two",
          email: "participant-2@example.com",
          image: null,
        },
      },
      {
        id: "participant-3",
        projectId: "project-1",
        memberId: "member-3",
        userId: "user-3",
        country: "DE",
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: "user-3",
          name: "Participant Three",
          email: "participant-3@example.com",
          image: null,
        },
      },
    ];

    const sharedTravelLegs = [
      { transportEmissionProfile: "car", distanceKm: 10 },
      { transportEmissionProfile: "train", distanceKm: 20.5 },
      { transportEmissionProfile: "bus", distanceKm: -5 },
    ] satisfies ProjectSharedTravelLegForCalculation[];

    const stats = getProjectStatistics(project, participants, sharedTravelLegs);

    expect(stats.participantsCount).toBe(3);
    expect(stats.sharedTravelLegsCount).toBe(3);
    expect(stats.totalDistanceKm).toBeCloseTo(30.5);
    expect(stats.durationDays).toBe(4);
    expect(stats.sharedTravelCO2Kg).toBeCloseTo(
      10 * TRANSPORT_EMISSION_FACTORS.car +
        20.5 * TRANSPORT_EMISSION_FACTORS.train,
    );
  });

  it("handles missing or empty inputs safely", () => {
    const stats = getProjectStatistics(null, null, null);
    expect(stats.participantsCount).toBe(0);
    expect(stats.sharedTravelLegsCount).toBe(0);
    expect(stats.totalDistanceKm).toBe(0);
    expect(stats.durationDays).toBe(0);
    expect(stats.sharedTravelCO2Kg).toBe(0);
  });
});
