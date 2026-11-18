import { createHmac, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  organization,
  projectsTable,
  session,
  member,
  user,
  hostProjectAssignmentsTable,
  projectPartnerOrganizationsTable,
  partnerCoordinatorAssignmentsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders.get }));

import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

/**
 * Seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). The Coordinator creates and edits
 * through the supported procedures, the Owner crosses the dedicated
 * archive boundary; the attempted foreign Organization is ignored because
 * creation stays app-owned. Case Projects and sessions are removed
 * afterwards; seed actors are never deleted or re-roled.
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
const caseUserIds: string[] = [];
let headers: Headers;
const client = createRouterClient(router, { context: async () => ({ headers }) });

async function signInSession(
  userId: string,
  activeOrganizationId: string | null = seedOrgId,
): Promise<Headers> {
  const token = randomUUID();
  const id = randomUUID();
  await db.insert(session).values({
    id,
    token,
    userId,
    activeOrganizationId,
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
  if (!seedOrg) throw new Error("Seed Organization is missing");
  const partnerOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_PARTNER_ORG_SLUG),
  });
  if (!partnerOrg) throw new Error("Seed Partner Organization is missing");
  const coordinator = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_COORDINATOR_EMAIL),
  });
  if (!coordinator) throw new Error("Seed Coordinator is missing");
  const owner = await db.query.user.findFirst({
    where: (users, { eq: eqUser }) => eqUser(users.email, SEED_USER.email),
  });
  if (!owner) throw new Error("Seed Owner is missing");
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
  if (caseUserIds.length)
    await db.delete(user).where(inArray(user.id, caseUserIds));
  // Seed actors survive every case: fail loudly on accidental deletion.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "seed Organization was deleted",
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
    costTrackerArchived: true,
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
    costTrackerArchived: false,
    archived: false,
  });

  const completedAt = new Date("2026-02-01");
  // A pre-existing Cost Tracker transition must survive Calculator edits.
  await db
    .update(projectsTable)
    .set({
      completedAt,
      completedByUserId: coordinatorUserId,
      costTrackerArchived: true,
    })
    .where(eq(projectsTable.id, created.project.id));
  const updated = await client.projects.update({
    id: created.project.id,
    data: {
      ...form,
      name: "Legitimate rename",
      completedAt: null,
      completedByUserId: null,
      costTrackerArchived: false,
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
    costTrackerArchived: true,
    archived: false,
  });
  await expect(
    client.projects.archive({ id: created.project.id }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  useHeaders(await signInSession(ownerUserId));
  const archived = await client.projects.archive({
    id: created.project.id,
  });
  expect(archived.project.archived).toBe(true);
  const edited = await client.projects.update({
    id: created.project.id,
    data: { ...form, archived: false } as typeof form,
  });
  expect(edited.project.archived).toBe(true);
});

const lifecycleCases = [
  { role: "owner", assigned: false, allowed: true },
  { role: "admin", assigned: true, allowed: true },
  { role: "admin", assigned: false, allowed: false },
  { role: "coordinator", assigned: true, allowed: false },
  { role: "coordinator", assigned: false, allowed: false },
  { role: "participant", assigned: true, allowed: false },
  { role: "participant,admin", assigned: true, allowed: true },
  { role: "participant,coordinator", assigned: true, allowed: false },
  { role: "owner,admin", assigned: false, allowed: true },
  { role: "unknown", assigned: true, allowed: false },
  { role: "unknown,admin", assigned: true, allowed: true },
];

async function lifecycleActor(role: string) {
  const id = randomUUID();
  caseUserIds.push(id);
  await db.insert(user).values({
    id,
    name: "Lifecycle actor",
    email: `${id}@example.invalid`,
    emailVerified: true,
  });
  await db.insert(member).values({
    id: randomUUID(),
    userId: id,
    organizationId: seedOrgId,
    role,
    createdAt: new Date(),
  });
  return id;
}

async function lifecycleProject() {
  const id = randomUUID();
  caseProjectIds.push(id);
  await db.insert(projectsTable).values({
    id,
    organizationId: seedOrgId,
    name: "Lifecycle matrix",
    country: "DE",
    location: "Berlin",
    startDate: new Date(),
    endDate: new Date(),
    costTrackerArchived: true,
  });
  return id;
}

it.each(lifecycleCases)(
  "preserves Calculator $role assigned=$assigned lifecycle authority",
  async ({ role, assigned, allowed }) => {
    const actorId = await lifecycleActor(role);
    const id = await lifecycleProject();
    if (assigned)
      await db
        .insert(hostProjectAssignmentsTable)
        .values({ projectId: id, userId: actorId });
    useHeaders(await signInSession(actorId));
    for (const action of ["archive", "reopen"] as const) {
      expect(
        await auth.api.hasPermission({
          headers,
          body: { permissions: { calculatorProjectLifecycle: [action] } },
        }),
      ).toMatchObject({
        success: ["owner", "admin"].some((staff) =>
          role.split(",").includes(staff),
        ),
      });
      expect(
        await auth.api.hasPermission({
          headers,
          body: { permissions: { costTrackerProjectLifecycle: [action] } },
        }),
      ).toMatchObject({ success: false });
    }
    if (!role.includes("unknown") && role !== "participant,coordinator") {
      const detail = await client.projects.getById({ id });
      expect({ archive: detail.canArchive, reopen: detail.canReopen }).toEqual({
        archive: allowed,
        reopen: allowed,
      });
    }
    for (const action of ["archive", "reopen"] as const) {
      await db
        .update(projectsTable)
        .set({ archived: action === "reopen" })
        .where(eq(projectsTable.id, id));
      const request = client.projects[action]({ id });
      if (allowed) {
        expect((await request).project).toMatchObject({
          archived: action === "archive",
          costTrackerArchived: true,
        });
        expect((await client.projects[action]({ id })).project.archived).toBe(
          action === "archive",
        );
      } else {
        await expect(request).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      expect(
        await db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, id),
        }),
      ).toMatchObject({
        archived: allowed ? action === "archive" : action === "reopen",
        costTrackerArchived: true,
      });
    }
  },
);

it.each(["owner", "admin"])(
  "bounds list availability database reads for %s as the Project count grows",
  async (role) => {
    const actorId = await lifecycleActor(role);
    useHeaders(await signInSession(actorId));
    const assignedId = await lifecycleProject();
    await db.insert(hostProjectAssignmentsTable).values({
      projectId: assignedId,
      userId: actorId,
    });
    await db
      .update(projectsTable)
      .set({ archived: true })
      .where(eq(projectsTable.id, assignedId));
    await client.projects.list({});
    const pool = globalThis.__pool;
    if (!pool) throw new Error("Database pool was not initialized");
    const reads = vi.spyOn(pool, "query");
    try {
      const before = await client.projects.list({});
      const beforeReads = reads.mock.calls.length;
      reads.mockClear();
      const extraIds = await Promise.all(
        Array.from({ length: 4 }, () => lifecycleProject()),
      );
      reads.mockClear();
      const after = await client.projects.list({});
      const afterReads = reads.mock.calls.length;
      expect(after).toHaveLength(before.length + 4);
      expect(after.find((project) => project.id === assignedId)).toMatchObject({
        archived: true,
        canArchive: true,
        canReopen: true,
      });
      for (const id of extraIds) {
        expect(after.find((project) => project.id === id)).toMatchObject({
          canArchive: role === "owner",
          canReopen: role === "owner",
        });
      }
      console.info(
        JSON.stringify({
          role,
          beforeProjects: before.length,
          afterProjects: after.length,
          beforeReads,
          afterReads,
        }),
      );
      expect(afterReads).toBe(beforeReads);
      expect(afterReads).toBeLessThanOrEqual(12);
      await db
        .delete(hostProjectAssignmentsTable)
        .where(
          and(
            eq(hostProjectAssignmentsTable.projectId, assignedId),
            eq(hostProjectAssignmentsTable.userId, actorId),
          ),
        );
      const refreshed = await client.projects.list({});
      expect(
        refreshed.find((project) => project.id === assignedId),
      ).toMatchObject({
        canArchive: role === "owner",
        canReopen: role === "owner",
      });
    } finally {
      reads.mockRestore();
    }
  },
);

it("reevaluates Calculator Membership, assignment, tenant and actor context on every command", async () => {
  const actorId = await lifecycleActor("admin");
  const id = await lifecycleProject();
  const otherId = await lifecycleProject();
  await db
    .insert(hostProjectAssignmentsTable)
    .values({ projectId: otherId, userId: actorId });
  useHeaders(await signInSession(actorId));
  await expect(client.projects.archive({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await db
    .insert(hostProjectAssignmentsTable)
    .values({ projectId: id, userId: actorId });
  await client.projects.archive({ id });
  await db
    .delete(hostProjectAssignmentsTable)
    .where(
      and(
        eq(hostProjectAssignmentsTable.projectId, id),
        eq(hostProjectAssignmentsTable.userId, actorId),
      ),
    );
  await expect(client.projects.reopen({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: partnerOrgId,
    userId: actorId,
    role: "owner",
    createdAt: new Date(),
  });
  await expect(client.projects.reopen({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await db
    .insert(hostProjectAssignmentsTable)
    .values({ projectId: id, userId: actorId });
  await db
    .delete(member)
    .where(and(eq(member.organizationId, seedOrgId), eq(member.userId, actorId)));
  await expect(client.projects.reopen({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  useHeaders(await signInSession(actorId, partnerOrgId));
  await expect(client.projects.reopen({ id })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const partnershipId = randomUUID();
  await db
    .insert(projectPartnerOrganizationsTable)
    .values({ id: partnershipId, projectId: id, organizationId: partnerOrgId });
  await db
    .insert(partnerCoordinatorAssignmentsTable)
    .values({ partnershipId, userId: actorId });
  await db
    .update(member)
    .set({ role: "coordinator" })
    .where(
      and(eq(member.organizationId, partnerOrgId), eq(member.userId, actorId)),
    );
  await expect(client.projects.reopen({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  useHeaders(await signInSession(actorId, null));
  await expect(client.projects.archive({ id })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  useHeaders(new Headers());
  await expect(client.projects.archive({ id })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
});
