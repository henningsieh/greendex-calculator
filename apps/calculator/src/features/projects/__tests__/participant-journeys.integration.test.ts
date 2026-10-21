import { createHmac, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import { organization, projectsTable, session } from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";

import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Reads resolve the seeded showcase
 * slice — the Owner Participation with its Paris journey, the linked
 * Participation without a journey, and the login-free Participation with
 * its Prague journey — instead of inventing a private Project dataset.
 * The only case-owned row is the sign-in session, removed afterwards;
 * canonical actors are never deleted.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_ORG_SLUG = "seed-partner-org";
const SEED_SHOWCASE_PROJECT_NAME = "Carbon Footprint Workshop";
const SEED_BARE_PARTICIPANT_EMAIL = "seed-participant@example.org";
const SEED_UNLINKED_PARTICIPANT_EMAIL = "seed-unlinked-participant@example.org";

let seedOrgId = "";
let partnerOrgId = "";
let showcaseProjectId = "";
let sessionId = "";
let headers: Headers;
const client = createRouterClient(router, { context: () => ({ headers }) });

beforeAll(async () => {
  const seedOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_ORG_SLUG),
  });
  if (!seedOrg) throw new Error("Canonical seed Organization is missing");
  const partnerOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_PARTNER_ORG_SLUG),
  });
  if (!partnerOrg)
    throw new Error("Canonical seed Partner Organization is missing");
  const ownerUser = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_USER.email),
  });
  if (!ownerUser) throw new Error("Canonical seed Owner is missing");
  const showcase = await db.query.projectsTable.findFirst({
    where: and(
      eq(projectsTable.organizationId, seedOrg.id),
      eq(projectsTable.name, SEED_SHOWCASE_PROJECT_NAME),
    ),
  });
  if (!showcase) throw new Error("Canonical showcase Project is missing");
  seedOrgId = seedOrg.id;
  partnerOrgId = partnerOrg.id;
  showcaseProjectId = showcase.id;

  const token = randomUUID();
  sessionId = randomUUID();
  await db.insert(session).values({
    id: sessionId,
    userId: ownerUser.id,
    token,
    activeOrganizationId: seedOrg.id,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const context = await auth.$context;
  const signature = createHmac("sha256", context.secret)
    .update(token)
    .digest("base64");
  headers = new Headers({
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
  });
});

afterAll(async () => {
  if (sessionId) {
    await db.delete(session).where(eq(session.id, sessionId));
    sessionId = "";
  }
  // Canonical actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
  expect(
    await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.organizationId, seedOrgId),
        eq(projectsTable.name, SEED_SHOWCASE_PROJECT_NAME),
      ),
    }),
    "canonical showcase Project was deleted",
  ).not.toBeUndefined();
});

it("reads the canonical Participant Journey on the Calculator Project without losing participants without journeys", async () => {
  const participants = await client.projects.getParticipants({
    projectId: showcaseProjectId,
  });
  expect(participants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        email: SEED_USER.email,
        journey: expect.objectContaining({
          projectParticipantId: expect.any(String),
          origin: "Paris",
          destination: "Berlin",
          tripType: "round-trip",
          erasmusDistanceKm: "878.00",
        }),
      }),
      expect.objectContaining({
        email: SEED_BARE_PARTICIPANT_EMAIL,
        journey: null,
      }),
    ]),
  );
  const bare = participants.find(
    (participant) => participant.email === SEED_BARE_PARTICIPANT_EMAIL,
  );
  expect(bare?.journey).toBeNull();
});

it("returns Participation-owned display fields and the Journey when no User is linked", async () => {
  const participants = await client.projects.getParticipants({
    projectId: showcaseProjectId,
  });
  const unlinked = participants.find(
    (participant) => participant.email === SEED_UNLINKED_PARTICIPANT_EMAIL,
  );
  expect(unlinked).toEqual(
    expect.objectContaining({
      displayName: "Seed Participation without login",
      email: SEED_UNLINKED_PARTICIPANT_EMAIL,
      userId: null,
      user: null,
      journey: expect.objectContaining({
        projectParticipantId: unlinked?.id,
        origin: "Prague",
        destination: "Berlin",
      }),
    }),
  );
});

it("does not expose Participant Journeys from another active Organization", async () => {
  await db
    .update(session)
    .set({ activeOrganizationId: partnerOrgId })
    .where(eq(session.id, sessionId));
  try {
    await expect(
      client.projects.getParticipants({ projectId: showcaseProjectId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  } finally {
    await db
      .update(session)
      .set({ activeOrganizationId: seedOrgId })
      .where(eq(session.id, sessionId));
  }
});
