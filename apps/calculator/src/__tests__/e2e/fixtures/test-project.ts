import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  member,
  organization,
  projectSharedTravelLegsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";

import type { ProjectSharedTravelLeg } from "@/features/project-shared-travel-legs/types";

/**
 * Test fixture for creating a project that can be used in e2e tests
 */
export class TestProjectFixture {
  userId = randomUUID();
  orgId = randomUUID();
  projectId = randomUUID();

  async setup() {
    // Create test user
    await db.insert(user).values({
      id: this.userId,
      name: "E2E Test User",
      email: `e2e-test-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test organization
    await db.insert(organization).values({
      id: this.orgId,
      name: "E2E Test Organization",
      slug: `e2e-test-org-${Date.now()}-${randomUUID().slice(0, 8)}`,
      createdAt: new Date(),
    });

    // Add user as organization owner
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: this.orgId,
      userId: this.userId,
      role: "owner",
      createdAt: new Date(),
    });

    // Create test project
    await db.insert(projectsTable).values({
      id: this.projectId,
      name: "E2E Test Project",
      location: "Berlin, Germany",
      country: "DE",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-06-14"),
      welcomeMessage:
        "Welcome to the E2E Test Project! Let's calculate your carbon footprint.",
      organizationId: this.orgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db
      .insert(hostProjectAssignmentsTable)
      .values({ projectId: this.projectId, userId: this.userId });

    // Add canonical Project Shared Travel for participant-visible coverage.
    const sharedTravelLegs: Omit<
      ProjectSharedTravelLeg,
      "createdAt" | "updatedAt" | "travelDate" | "description"
    >[] = [
      {
        id: randomUUID(),
        projectId: this.projectId,
        transportEmissionProfile: "electricCar",
        distanceKm: 100,
      },
    ];

    for (const sharedTravelLeg of sharedTravelLegs) {
      await db.insert(projectSharedTravelLegsTable).values({
        id: sharedTravelLeg.id,
        projectId: sharedTravelLeg.projectId,
        transportEmissionProfile: sharedTravelLeg.transportEmissionProfile,
        distanceKm: sharedTravelLeg.distanceKm,
        description: null,
        travelDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return this.projectId;
  }

  async teardown() {
    try {
      // Delete project
      await db.delete(projectsTable).where(eq(projectsTable.id, this.projectId));

      // Delete organization membership
      await db.delete(member).where(eq(member.organizationId, this.orgId));

      // Delete organization
      await db.delete(organization).where(eq(organization.id, this.orgId));

      // Delete user
      await db.delete(user).where(eq(user.id, this.userId));
    } catch (error) {
      console.error("E2E test cleanup failed:", error);
      throw error; // Fail fast to surface cleanup issues
    }
  }
}
