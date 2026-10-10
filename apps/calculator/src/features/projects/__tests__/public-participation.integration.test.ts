import { createHmac, randomUUID } from "node:crypto";

import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  organization,
  session,
  member,
  projectSharedTravelLegsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  OrganizationFormSchema,
  EditOrganizationFormSchema,
} from "@/features/organizations/validation-schemas";
import { auth } from "@/lib/better-auth";
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

describe("organization country contract", () => {
  const countryUserId = randomUUID();
  const countryOrganizationId = randomUUID();
  const sessionToken = randomUUID();
  let headers: Headers;

  beforeAll(async () => {
    await db.insert(user).values({
      id: countryUserId,
      name: "Country Contract User",
      email: `country-${countryUserId}@example.com`,
    });
    await db.insert(organization).values({
      id: countryOrganizationId,
      name: "Country Contract Organization",
      slug: `country-${countryOrganizationId}`,
      country: "DE",
      createdAt: new Date(),
    });
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: countryOrganizationId,
      userId: countryUserId,
      role: "owner",
      createdAt: new Date(),
    });
    await db.insert(session).values({
      id: randomUUID(),
      token: sessionToken,
      userId: countryUserId,
      activeOrganizationId: countryOrganizationId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const context = await auth.$context;
    const signature = createHmac("sha256", context.secret)
      .update(sessionToken)
      .digest("base64");
    headers = new Headers({
      cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${sessionToken}.${signature}`)}`,
    });
  });

  afterAll(async () => {
    await db
      .delete(organization)
      .where(eq(organization.id, countryOrganizationId));
    await db.delete(user).where(eq(user.id, countryUserId));
  });
  it.each([undefined, null, "", "US", "de"])(
    "rejects invalid country %s in both forms",
    (country) => {
      const input = { name: "Country Contract Organization", country };
      expect(OrganizationFormSchema.safeParse(input).success).toBe(false);
      expect(EditOrganizationFormSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(EU_COUNTRY_CODES)("accepts EU country %s in both forms", (country) => {
    const input = { name: "Country Contract Organization", country };
    expect(OrganizationFormSchema.safeParse(input).success).toBe(true);
    expect(EditOrganizationFormSchema.safeParse(input).success).toBe(true);
  });

  it.each([undefined, null, "", "US", "de"])(
    "rejects invalid country %s at the create API boundary",
    async (country) => {
      await expect(
        auth.api.createOrganization({
          // Exercise untyped callers through the runtime input boundary.
          body: JSON.parse(
            JSON.stringify({
              userId: countryUserId,
              name: "Country Contract Organization",
              slug: `country-contract-${randomUUID()}`,
              country,
            }),
          ),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    },
  );

  it("retains the required country on a rename-only API update", async () => {
    const updated = await auth.api.updateOrganization({
      headers,
      body: {
        organizationId: countryOrganizationId,
        data: { name: "Renamed Country Contract Organization" },
      },
    });
    expect(updated?.country).toBe("DE");
  });

  it.each([null, "", "US", "de"])(
    "rejects invalid supplied country %s at the update API boundary",
    async (country) => {
      await expect(
        auth.api.updateOrganization({
          headers,
          body: JSON.parse(
            JSON.stringify({
              organizationId: countryOrganizationId,
              data: { country },
            }),
          ),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    },
  );
});
