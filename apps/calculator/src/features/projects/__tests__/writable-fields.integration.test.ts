import { createHmac, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import { organization, projectsTable, session } from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders.get }));

import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). The Coordinator creates and edits
 * through the supported procedures, the Owner crosses the dedicated
 * archive boundary; the attempted foreign Organization is ignored because
 * creation stays app-owned. Case Projects and sessions are removed
 * afterwards; canonical actors are never deleted or re-roled.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_ORG_SLUG = "seed-partner-org";
const SEED_COORDINATOR_EMAIL = "seed-coordinator@example.org";

let seedOrgId = "";
let partnerOrgId = "";
let coordinatorUserId = "";
let ownerUserId = "";
const sessionIds: string[] = [];
const caseProjectIds: string[] = [];
let headers: Headers;
const client = createRouterClient(router, { context: async () => ({ headers }) });

async function signInSession(userId: string): Promise<Headers> {
  const token = randomUUID();
  const id = randomUUID();
  await db.insert(session).values({
    id,
    token,
    userId,
    activeOrganizationId: seedOrgId,
    expiresAt: new Date(Date.now() + 600_000),
  });
  sessionIds.push(id);
  const context = await auth.$context;
  const signature = createHmac("sha256", context.secret)
    .update(token)
    .digest("base64");
  return new Headers({
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
  });
}

function useHeaders(next: Headers) {
  headers = next;
  requestHeaders.get.mockResolvedValue(next);
}

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
  const coordinator = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_COORDINATOR_EMAIL),
  });
  if (!coordinator) throw new Error("Canonical seed Coordinator is missing");
  const owner = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_USER.email),
  });
  if (!owner) throw new Error("Canonical seed Owner is missing");
  seedOrgId = seedOrg.id;
  partnerOrgId = partnerOrg.id;
  coordinatorUserId = coordinator.id;
  ownerUserId = owner.id;
  useHeaders(await signInSession(coordinator.id));
});

afterAll(async () => {
  for (const id of caseProjectIds.splice(0)) {
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
  }
  for (const id of sessionIds.splice(0)) {
    await db.delete(session).where(eq(session.id, id));
  }
  // Canonical actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
});

it("keeps create/edit app-owned and leaves archive behind its dedicated permission boundary", async () => {
  const form = {
    name: "Writable fields Project",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-05"),
    location: "Berlin",
    country: "DE" as const,
    organizationId: partnerOrgId,
    welcomeMessage: "Welcome",
  };
  const attemptedLifecycle = {
    completedAt: new Date(),
    completedByUserId: coordinatorUserId,
    costSubmissionWindowOpen: true,
    archived: true,
  };
  const created = await client.projects.create({
    ...form,
    ...attemptedLifecycle,
  });
  caseProjectIds.push(created.project.id);
  expect(created.success).toBe(true);
  expect(created.project).toMatchObject({
    ...form,
    organizationId: seedOrgId,
    completedAt: null,
    completedByUserId: null,
    costSubmissionWindowOpen: false,
    archived: false,
  });

  const completedAt = new Date("2026-02-01");
  // A pre-existing Cost Tracker transition must survive Calculator edits.
  await db
    .update(projectsTable)
    .set({
      completedAt,
      completedByUserId: coordinatorUserId,
      costSubmissionWindowOpen: true,
    })
    .where(eq(projectsTable.id, created.project.id));
  const updated = await client.projects.update({
    id: created.project.id,
    data: {
      ...form,
      name: "Legitimate rename",
      completedAt: null,
      completedByUserId: null,
      costSubmissionWindowOpen: false,
      archived: true,
    } as typeof form,
  });
  expect(updated.success).toBe(true);
  const persisted = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, created.project.id),
  });
  expect(persisted).toMatchObject({
    name: "Legitimate rename",
    organizationId: seedOrgId,
    completedAt,
    completedByUserId: coordinatorUserId,
    costSubmissionWindowOpen: true,
    archived: false,
  });
  await expect(
    client.projects.archive({ id: created.project.id, archived: true }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  useHeaders(await signInSession(ownerUserId));
  const archived = await client.projects.archive({
    id: created.project.id,
    archived: true,
  });
  expect(archived.project.archived).toBe(true);
  const edited = await client.projects.update({
    id: created.project.id,
    data: { ...form, archived: false } as typeof form,
  });
  expect(edited.project.archived).toBe(true);
});
