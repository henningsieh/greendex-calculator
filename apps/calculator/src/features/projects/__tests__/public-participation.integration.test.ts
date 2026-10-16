import { createHmac, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  session,
  projectSharedTravelLegsTable,
  projectsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  OrganizationFormSchema,
  EditOrganizationFormSchema,
} from "@/features/organizations/validation-schemas";
import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). The public participation contract
 * reads the seeded showcase Project with its canonical shared travel
 * records; the country contract creates case Organizations through the
 * supported Better Auth behavior as the seeded Owner. Case Organizations
 * and sessions are removed afterwards; canonical actors are never deleted.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_SHOWCASE_PROJECT_NAME = "Carbon Footprint Workshop";

const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

let showcaseProjectId = "";

describe("public participation contract", () => {
  beforeAll(async () => {
    const seedOrg = await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    });
    if (!seedOrg) throw new Error("Canonical seed Organization is missing");
    const showcase = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.organizationId, seedOrg.id),
        eq(projectsTable.name, SEED_SHOWCASE_PROJECT_NAME),
      ),
    });
    if (!showcase) throw new Error("Canonical showcase Project is missing");
    showcaseProjectId = showcase.id;
  });

  afterAll(async () => {
    // Canonical actors survive every case: fail loudly on accidental deletion.
    expect(
      await db.query.projectsTable.findFirst({
        where: eq(projectsTable.id, showcaseProjectId),
      }),
      "canonical showcase Project was deleted",
    ).not.toBeUndefined();
  });

  it("exposes only canonical shared travel records", async () => {
    const project = await client.projects.getForParticipation({
      id: showcaseProjectId,
    });

    const storedLegs = await db
      .select()
      .from(projectSharedTravelLegsTable)
      .where(eq(projectSharedTravelLegsTable.projectId, showcaseProjectId));
    expect(storedLegs.length).toBeGreaterThan(0);
    expect(project.sharedTravelLegs).toEqual(
      expect.arrayContaining(
        storedLegs.map((leg) =>
          expect.objectContaining({
            id: leg.id,
            projectId: showcaseProjectId,
            transportEmissionProfile: leg.transportEmissionProfile,
            distanceKm: leg.distanceKm,
            description: leg.description,
          }),
        ),
      ),
    );
    expect(project.sharedTravelLegs).toHaveLength(storedLegs.length);
    expect(project.hostCoordinatorNames).toEqual([
      "Seed Coordinator",
      SEED_USER.name,
    ]);
    expect(project).not.toHaveProperty("hostAssignments");
    expect(project).not.toHaveProperty("activities");
  });
});

describe("organization country contract", () => {
  const caseOrganizationIds: string[] = [];
  const caseSessionIds: string[] = [];
  let ownerHeaders: Headers;
  let ownerActiveHeaders: Headers;
  let ownerUserId = "";

  async function sessionHeaders(
    userId: string,
    activeOrganizationId: string,
  ): Promise<Headers> {
    const token = randomUUID();
    const id = randomUUID();
    await db.insert(session).values({
      id,
      token,
      userId,
      activeOrganizationId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    caseSessionIds.push(id);
    const context = await auth.$context;
    const signature = createHmac("sha256", context.secret)
      .update(token)
      .digest("base64");
    return new Headers({
      cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
    });
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
    ownerUserId = owner.id;
    ownerHeaders = await sessionHeaders(owner.id, seedOrg.id);
    const slug = `country-${randomUUID()}`;
    const created = await auth.api.createOrganization({
      headers: ownerHeaders,
      body: {
        userId: owner.id,
        name: "Country Contract Organization",
        slug,
        country: "DE",
      },
    });
    const createdId =
      typeof created === "string" ? created : (created as { id: string }).id;
    caseOrganizationIds.push(createdId);
    ownerActiveHeaders = await sessionHeaders(owner.id, createdId);
  });

  afterAll(async () => {
    for (const id of caseSessionIds.splice(0)) {
      await db.delete(session).where(eq(session.id, id));
    }
    const caseOrgIds = caseOrganizationIds.splice(0);
    if (caseOrgIds.length) {
      await db.delete(member).where(inArray(member.organizationId, caseOrgIds));
      await db
        .delete(invitation)
        .where(inArray(invitation.organizationId, caseOrgIds));
      await db.delete(organization).where(inArray(organization.id, caseOrgIds));
    }
    // Canonical actors survive every case: fail loudly on accidental deletion.
    expect(
      await db.query.organization.findFirst({
        where: eq(organization.slug, SEED_ORG_SLUG),
      }),
      "canonical seed Organization was deleted",
    ).not.toBeUndefined();
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
              userId: ownerUserId,
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
      headers: ownerActiveHeaders,
      body: {
        organizationId: caseOrganizationIds[0] as string,
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
          headers: ownerActiveHeaders,
          body: JSON.parse(
            JSON.stringify({
              organizationId: caseOrganizationIds[0] as string,
              data: { country },
            }),
          ),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    },
  );
});
