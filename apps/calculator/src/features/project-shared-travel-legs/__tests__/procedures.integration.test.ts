import { randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  organization,
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
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

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Legs are created, updated, and
 * deleted through the supported procedures on a canonical Project owned by the
 * seeded Hosting Organization; the seeded Partner-owned Project covers
 * cross-Organization scoping. Cleanup removes only case rows — canonical
 * seed Projects and showcase legs are never deleted.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_PROJECT_NAME = "Seed Partner Project";
const SEED_SHARED_TRAVEL_PROJECT_ID =
  "shared-travel-procedures-project-canonical";
const caseLegIds: string[] = [];

let ownerUserId = "";
let ownerUserEmail = "";
let seedOrgId = "";
let sharedTravelProjectId = "";
let partnerProjectId = "";
const headers = new Headers();

const client = createRouterClient(router, {
  context: async () => ({ headers }),
});

function mockSession() {
  authMocks.getSession.mockResolvedValue({
    session: {
      id: randomUUID(),
      userId: ownerUserId,
      activeOrganizationId: seedOrgId,
    },
    user: {
      id: ownerUserId,
      name: "Seed Owner",
      email: ownerUserEmail,
    },
  });
  authMocks.hasPermission.mockResolvedValue({ success: true, error: null });
}

beforeAll(async () => {
  const seedOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_ORG_SLUG),
  });
  if (!seedOrg) throw new Error("Canonical seed Organization is missing");
  const owner = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_USER.email),
  });
  if (!owner) throw new Error("Canonical seed Owner is missing");
  const partnerProject = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.name, SEED_PARTNER_PROJECT_NAME),
  });
  if (!partnerProject)
    throw new Error("Canonical seed Partner Project is missing");
  ownerUserId = owner.id;
  ownerUserEmail = owner.email ?? SEED_USER.email;
  seedOrgId = seedOrg.id;
  partnerProjectId = partnerProject.id;
  const sharedTravelProject = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, SEED_SHARED_TRAVEL_PROJECT_ID),
  });
  if (!sharedTravelProject || sharedTravelProject.organizationId !== seedOrgId)
    throw new Error("Canonical Shared Travel Procedures Project is missing");
  sharedTravelProjectId = sharedTravelProject.id;
});

beforeEach(() => {
  mockSession();
});

afterEach(async () => {
  // Remove only legs created by behavior under test, never the canonical Project.
  if (caseLegIds.length)
    await db
      .delete(projectSharedTravelLegsTable)
      .where(inArray(projectSharedTravelLegsTable.id, caseLegIds.splice(0)));
  vi.clearAllMocks();
});

afterAll(async () => {
  expect(
    await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, SEED_SHARED_TRAVEL_PROJECT_ID),
    }),
    "canonical Shared Travel Procedures Project was deleted",
  ).not.toBeUndefined();
  // Canonical actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
  expect(
    await db.query.projectsTable.findFirst({
      where: eq(projectsTable.name, SEED_PARTNER_PROJECT_NAME),
    }),
    "canonical seed Partner Project was deleted",
  ).not.toBeUndefined();
});

describe("canonical Project Shared Travel Leg procedures", () => {
  it("creates and lists an electric-car leg with canonical fields over the existing storage", async () => {
    const travelDate = new Date("2026-05-12T00:00:00.000Z");

    const created = await client.projectSharedTravelLegs.create({
      projectId: sharedTravelProjectId,
      transportEmissionProfile: "electricCar",
      distanceKm: 42.5,
      description: "Station transfer",
      travelDate,
    });
    caseLegIds.push(created.sharedTravelLeg.id);

    expect(created.success).toBe(true);
    expect(created.sharedTravelLeg).toMatchObject({
      projectId: sharedTravelProjectId,
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
      client.projectSharedTravelLegs.list({ projectId: sharedTravelProjectId }),
    ).resolves.toEqual([created.sharedTravelLeg]);
  });

  it("updates a leg through the canonical contract", async () => {
    const created = await client.projectSharedTravelLegs.create({
      projectId: sharedTravelProjectId,
      transportEmissionProfile: "train",
      distanceKm: 80,
      description: null,
      travelDate: null,
    });
    caseLegIds.push(created.sharedTravelLeg.id);
    const travelDate = new Date("2026-06-01T00:00:00.000Z");

    const updated = await client.projectSharedTravelLegs.update({
      projectId: sharedTravelProjectId,
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
        projectId: sharedTravelProjectId,
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
        projectId: sharedTravelProjectId,
        id: created.sharedTravelLeg.id,
        data: { transportEmissionProfile: "plane" },
      }),
    ).rejects.toThrow();
    await expect(
      client.projectSharedTravelLegs.list({ projectId: sharedTravelProjectId }),
    ).resolves.toMatchObject([{ transportEmissionProfile: "bus" }]);
  });

  it("deletes a leg through the canonical contract", async () => {
    const created = await client.projectSharedTravelLegs.create({
      projectId: sharedTravelProjectId,
      transportEmissionProfile: "boat",
      distanceKm: 15,
      description: null,
      travelDate: null,
    });
    caseLegIds.push(created.sharedTravelLeg.id);

    await expect(
      client.projectSharedTravelLegs.delete({
        projectId: sharedTravelProjectId,
        id: created.sharedTravelLeg.id,
      }),
    ).resolves.toEqual({ success: true });
    await expect(
      client.projectSharedTravelLegs.list({ projectId: sharedTravelProjectId }),
    ).resolves.toEqual([]);
  });

  it("preserves active-organization scoping and typed forbidden errors", async () => {
    await expect(
      client.projectSharedTravelLegs.list({ projectId: partnerProjectId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.projectSharedTravelLegs.create({
        projectId: partnerProjectId,
        transportEmissionProfile: "train",
        distanceKm: 20,
        description: null,
        travelDate: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const persisted = await db
      .select()
      .from(projectSharedTravelLegsTable)
      .where(eq(projectSharedTravelLegsTable.projectId, partnerProjectId));
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
          projectId: sharedTravelProjectId,
          transportEmissionProfile,
          distanceKm: 20,
          description: null,
          travelDate: null,
        }),
      ).rejects.toThrow();
      await expect(
        client.projectSharedTravelLegs.list({ projectId: sharedTravelProjectId }),
      ).resolves.toEqual([]);
    },
  );

  it("exposes only the Project Shared Travel Leg namespace", () => {
    expect(router).toHaveProperty("projectSharedTravelLegs");
    // Regression guard: the removed compatibility namespace must stay absent.
    expect(router).not.toHaveProperty("projectActivities");
  });
});
