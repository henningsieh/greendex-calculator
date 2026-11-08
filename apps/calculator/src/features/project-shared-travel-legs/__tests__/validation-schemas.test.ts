import { describe, expect, it } from "vitest";

import {
  CreateProjectSharedTravelLegInputSchema,
  UpdateProjectSharedTravelLegInputSchema,
} from "@/features/project-shared-travel-legs/validation-schemas";

const validCreateInput = {
  projectId: "project-1",
  transportEmissionProfile: "electricCar" as const,
  distanceKm: 120.5,
  description: "Shared transfer",
  travelDate: new Date("2026-04-10T00:00:00.000Z"),
};

describe("Project Shared Travel Leg contract schemas", () => {
  it("accepts standard create and update fields including electric car", () => {
    expect(
      CreateProjectSharedTravelLegInputSchema.safeParse(validCreateInput).success,
    ).toBe(true);

    expect(
      UpdateProjectSharedTravelLegInputSchema.safeParse({
        projectId: validCreateInput.projectId,
        id: "leg-1",
        data: {
          transportEmissionProfile: "electricCar",
          distanceKm: 10.1,
          description: null,
          travelDate: null,
        },
      }).success,
    ).toBe(true);
  });

  it.each(["plane", "unknown"])(
    "rejects the prohibited or unknown %s profile",
    (transportEmissionProfile) => {
      expect(
        CreateProjectSharedTravelLegInputSchema.safeParse({
          ...validCreateInput,
          transportEmissionProfile,
        }).success,
      ).toBe(false);
    },
  );

  it.each([0, 0.15, 6000.1])(
    "rejects invalid distance %s before persistence",
    (distanceKm) => {
      expect(
        CreateProjectSharedTravelLegInputSchema.safeParse({
          ...validCreateInput,
          distanceKm,
        }).success,
      ).toBe(false);
    },
  );
});
