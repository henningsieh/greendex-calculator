import { describe, expect, it } from "vitest";

import {
  CreateProjectWithSharedTravelLegsSchema,
  EditProjectWithSharedTravelLegsSchema,
} from "@/features/projects/validation-schemas";

const projectFields = {
  name: "Shared Travel Project",
  startDate: new Date("2026-04-10T00:00:00.000Z"),
  endDate: new Date("2026-04-14T00:00:00.000Z"),
  country: "DE" as const,
  location: "Berlin",
  organizationId: "organization-1",
};

const sharedTravelLeg = {
  transportEmissionProfile: "electricCar" as const,
  distanceKm: 120.5,
  description: "Airport transfer",
  travelDate: new Date("2026-04-10T00:00:00.000Z"),
};

describe("project shared travel form schemas", () => {
  it("accepts an electric-car Project Shared Travel Leg when creating a project", () => {
    expect(
      CreateProjectWithSharedTravelLegsSchema.safeParse({
        ...projectFields,
        sharedTravelLegs: [sharedTravelLeg],
      }).success,
    ).toBe(true);
  });

  it("accepts a project without Project Shared Travel Legs", () => {
    expect(
      CreateProjectWithSharedTravelLegsSchema.safeParse(projectFields).success,
    ).toBe(true);
  });

  it("uses the standard profile contract instead of accepting plane", () => {
    expect(
      CreateProjectWithSharedTravelLegsSchema.safeParse({
        ...projectFields,
        sharedTravelLegs: [
          { ...sharedTravelLeg, transportEmissionProfile: "plane" },
        ],
      }).success,
    ).toBe(false);
  });

  it("retains existing leg identifiers while editing unrelated project fields", () => {
    const result = EditProjectWithSharedTravelLegsSchema.safeParse({
      ...projectFields,
      name: "Renamed shared travel project",
      sharedTravelLegs: [
        {
          ...sharedTravelLeg,
          id: "leg-1",
          projectId: "project-1",
          isNew: false,
          isDeleted: false,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sharedTravelLegs?.[0]?.id).toBe("leg-1");
      expect(result.data.sharedTravelLegs?.[0]?.description).toBe(
        "Airport transfer",
      );
    }
  });
});
