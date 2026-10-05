import { randomUUID } from "node:crypto";

import type { EUCountryCode } from "@greendex/config/eu-countries";
import { db } from "@greendex/database";
import {
  organization,
  projectSharedTravelLegsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/better-auth", () => ({
  auth: {
    api: authMocks,
  },
}));

import { router } from "@/lib/orpc/router";

const userId = randomUUID();
const organizationId = randomUUID();
const projectId = randomUUID();
const foreignOrganizationId = randomUUID();
const foreignProjectId = randomUUID();
const headers = new Headers();

const client = createRouterClient(router, {
  context: async () => ({ headers }),
});

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Shared Travel Contract User",
    email: `shared-travel-${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values({ country: "DE",
    id: organizationId,
    name: "Shared Travel Contract Organization",
    slug: `shared-travel-${organizationId}`,
    createdAt: new Date(),
  });
  await db.insert(projectsTable).values({
    id: projectId,
    name: "Shared Travel Contract Project",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    location: "Berlin",
    country: "DE" as EUCountryCode,
    organizationId,
  });
  await db.insert(organization).values({ country: "DE",
    id: foreignOrganizationId,
    name: "Foreign Shared Travel Organization",
    slug: `foreign-shared-travel-${foreignOrganizationId}`,
    createdAt: new Date(),
  });
  await db.insert(projectsTable).values({
    id: foreignProjectId,
    name: "Foreign Shared Travel Project",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    location: "Paris",
    country: "FR" as EUCountryCode,
    organizationId: foreignOrganizationId,
  });
});

beforeEach(() => {
  authMocks.getSession.mockResolvedValue({
    session: {
      id: randomUUID(),
      userId,
      activeOrganizationId: organizationId,
    },
    user: {
      id: userId,
      name: "Shared Travel Contract User",
      email: `shared-travel-${userId}@example.com`,
    },
  });
  authMocks.hasPermission.mockResolvedValue(true);
});

afterEach(async () => {
  await db
    .delete(projectSharedTravelLegsTable)
    .where(eq(projectSharedTravelLegsTable.projectId, projectId));
  await db
    .delete(projectSharedTravelLegsTable)
    .where(eq(projectSharedTravelLegsTable.projectId, foreignProjectId));
  vi.clearAllMocks();
});

afterAll(async () => {
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, foreignProjectId));
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(organization).where(eq(organization.id, foreignOrganizationId));
  await db.delete(user).where(eq(user.id, userId));
});

describe("canonical Project Shared Travel Leg procedures", () => {
  it("creates and lists an electric-car leg with canonical fields over the existing storage", async () => {
    const travelDate = new Date("2026-05-12T00:00:00.000Z");

    const created = await client.projectSharedTravelLegs.create({
      projectId,
      transportEmissionProfile: "electricCar",
      distanceKm: 42.5,
      description: "Station transfer",
      travelDate,
    });

    expect(created.success).toBe(true);
    expect(created.sharedTravelLeg).toMatchObject({
      projectId,
      transportEmissionProfile: "electricCar",
      distanceKm: 42.5,
      description: "Station transfer",
      travelDate,
    });
    // Regression guard: procedure output must not recreate legacy field aliases.
    expect(created.sharedTravelLeg).not.toHaveProperty("activityType");
    expect(created.sharedTravelLeg).not.toHaveProperty("activityDate");

    const persisted = await db
      .select()
      .from(projectSharedTravelLegsTable)
      .where(eq(projectSharedTravelLegsTable.id, created.sharedTravelLeg.id));
    expect(persisted).toHaveLength(1);
    expect(persisted[0].transportEmissionProfile).toBe("electricCar");
    expect(persisted[0].travelDate).toEqual(travelDate);

    await expect(
      client.projectSharedTravelLegs.list({ projectId }),
    ).resolves.toEqual([created.sharedTravelLeg]);
  });

  it("updates a leg through the canonical contract", async () => {
    const created = await client.projectSharedTravelLegs.create({
      projectId,
      transportEmissionProfile: "train",
      distanceKm: 80,
      description: null,
      travelDate: null,
    });
    const travelDate = new Date("2026-06-01T00:00:00.000Z");

    const updated = await client.projectSharedTravelLegs.update({
      projectId,
      id: created.sharedTravelLeg.id,
      data: {
        transportEmissionProfile: "bus",
        distanceKm: 81.2,
        description: "Updated shared transfer",
        travelDate,
      },
    });

    expect(updated).toMatchObject({
      success: true,
      sharedTravelLeg: {
        id: created.sharedTravelLeg.id,
        projectId,
        transportEmissionProfile: "bus",
        distanceKm: 81.2,
        description: "Updated shared transfer",
        travelDate,
      },
    });

    const unsafeUpdate = client.projectSharedTravelLegs.update as unknown as (
      input: Record<string, unknown>,
    ) => Promise<unknown>;
    await expect(
      unsafeUpdate({
        projectId,
        id: created.sharedTravelLeg.id,
        data: { transportEmissionProfile: "plane" },
      }),
    ).rejects.toThrow();
    await expect(
      client.projectSharedTravelLegs.list({ projectId }),
    ).resolves.toMatchObject([{ transportEmissionProfile: "bus" }]);
  });

  it("deletes a leg through the canonical contract", async () => {
    const created = await client.projectSharedTravelLegs.create({
      projectId,
      transportEmissionProfile: "boat",
      distanceKm: 15,
      description: null,
      travelDate: null,
    });

    await expect(
      client.projectSharedTravelLegs.delete({
        projectId,
        id: created.sharedTravelLeg.id,
      }),
    ).resolves.toEqual({ success: true });
    await expect(
      client.projectSharedTravelLegs.list({ projectId }),
    ).resolves.toEqual([]);
  });

  it("preserves active-organization scoping and typed forbidden errors", async () => {
    await expect(
      client.projectSharedTravelLegs.list({ projectId: foreignProjectId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.projectSharedTravelLegs.create({
        projectId: foreignProjectId,
        transportEmissionProfile: "train",
        distanceKm: 20,
        description: null,
        travelDate: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const persisted = await db
      .select()
      .from(projectSharedTravelLegsTable)
      .where(eq(projectSharedTravelLegsTable.projectId, foreignProjectId));
    expect(persisted).toEqual([]);
  });

  it.each(["plane", "unknown"])(
    "rejects %s before persistence",
    async (transportEmissionProfile) => {
      const unsafeCreate = client.projectSharedTravelLegs.create as unknown as (
        input: Record<string, unknown>,
      ) => Promise<unknown>;
      await expect(
        unsafeCreate({
          projectId,
          transportEmissionProfile,
          distanceKm: 20,
          description: null,
          travelDate: null,
        }),
      ).rejects.toThrow();
      await expect(
        client.projectSharedTravelLegs.list({ projectId }),
      ).resolves.toEqual([]);
    },
  );

  it("exposes only the Project Shared Travel Leg namespace", () => {
    expect(router).toHaveProperty("projectSharedTravelLegs");
    // Regression guard: the removed compatibility namespace must stay absent.
    expect(router).not.toHaveProperty("projectActivities");
  });
});
