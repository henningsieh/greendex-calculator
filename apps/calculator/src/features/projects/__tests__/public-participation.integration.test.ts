import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  organization,
  projectSharedTravelLegsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { router } from "@/lib/orpc/router";

const userId = randomUUID();
const secondUserId = randomUUID();
const organizationId = randomUUID();
const projectId = randomUUID();
const travelLegId = randomUUID();
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

describe("public participation contract", () => {
  beforeAll(async () => {
    await db.insert(user).values({
      id: userId,
      name: "Public Participation Contract User",
      email: `public-participation-${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(user).values({
      id: secondUserId,
      name: "Another Coordinator",
      email: `public-participation-${secondUserId}@example.com`,
      emailVerified: true,
    });
    await db.insert(organization).values({
      country: "DE",
      id: organizationId,
      name: "Public Participation Contract Organization",
      slug: `public-participation-${organizationId}`,
      createdAt: new Date(),
    });
    await db.insert(projectsTable).values({
      id: projectId,
      name: "Public Participation Contract Project",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-05T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      organizationId,
    });
    await db.insert(hostProjectAssignmentsTable).values([
      { projectId, userId },
      { projectId, userId: secondUserId },
    ]);
    await db.insert(projectSharedTravelLegsTable).values({
      id: travelLegId,
      projectId,
      transportEmissionProfile: "electricCar",
      distanceKm: 100,
      description: "Public shared transfer",
      travelDate: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  afterAll(async () => {
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    await db.delete(organization).where(eq(organization.id, organizationId));
    await db.delete(user).where(eq(user.id, userId));
    await db.delete(user).where(eq(user.id, secondUserId));
  });

  it("exposes only canonical shared travel records", async () => {
    const project = await client.projects.getForParticipation({ id: projectId });

    expect(project.sharedTravelLegs).toEqual([
      expect.objectContaining({
        id: travelLegId,
        projectId,
        transportEmissionProfile: "electricCar",
        distanceKm: 100,
        description: "Public shared transfer",
      }),
    ]);
    expect(project.hostCoordinatorNames).toEqual([
      "Another Coordinator",
      "Public Participation Contract User",
    ]);
    expect(project).not.toHaveProperty("hostAssignments");
    expect(project).not.toHaveProperty("activities");
  });
});
