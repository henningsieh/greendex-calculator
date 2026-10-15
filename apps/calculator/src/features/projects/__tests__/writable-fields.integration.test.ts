import { createHmac, randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  member,
  organization,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ headers: requestHeaders.get }));

import { auth } from "@/lib/better-auth";
import { router } from "@/lib/orpc/router";

const userId = randomUUID();
const organizationId = randomUUID();
const foreignOrganizationId = randomUUID();
const membershipId = randomUUID();
const token = randomUUID();
let headers: Headers;
const client = createRouterClient(router, { context: async () => ({ headers }) });
const form = {
  name: "Writable fields Project",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-05"),
  location: "Berlin",
  country: "DE" as const,
  organizationId: foreignOrganizationId,
  welcomeMessage: "Welcome",
};

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Writable fields User",
    email: `${userId}@example.com`,
    emailVerified: true,
  });
  await db.insert(organization).values(
    [organizationId, foreignOrganizationId].map((id) => ({
      id,
      name: id,
      slug: id,
      country: "DE" as const,
      createdAt: new Date(),
    })),
  );
  await db.insert(member).values({
    id: membershipId,
    organizationId,
    userId,
    role: "coordinator",
    createdAt: new Date(),
  });
  await db.insert(session).values({
    id: randomUUID(),
    token,
    userId,
    activeOrganizationId: organizationId,
    expiresAt: new Date(Date.now() + 600_000),
  });
  const context = await auth.$context;
  const signature = createHmac("sha256", context.secret)
    .update(token)
    .digest("base64");
  headers = new Headers({
    cookie: `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`,
  });
  requestHeaders.get.mockResolvedValue(headers);
});

afterAll(async () => {
  await db
    .delete(projectsTable)
    .where(eq(projectsTable.organizationId, organizationId));
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(organization).where(eq(organization.id, foreignOrganizationId));
  await db.delete(user).where(eq(user.id, userId));
});

it("keeps create/edit app-owned and leaves archive behind its dedicated permission boundary", async () => {
  const attemptedLifecycle = {
    completedAt: new Date(),
    completedByUserId: userId,
    costSubmissionWindowOpen: true,
    archived: true,
  };
  const created = await client.projects.create({
    ...form,
    ...attemptedLifecycle,
  });
  expect(created.success).toBe(true);
  expect(created.project).toMatchObject({
    ...form,
    organizationId,
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
      completedByUserId: userId,
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
    where: { id: created.project.id },
  });
  expect(persisted).toMatchObject({
    name: "Legitimate rename",
    organizationId,
    completedAt,
    completedByUserId: userId,
    costSubmissionWindowOpen: true,
    archived: false,
  });
  await expect(
    client.projects.archive({ id: created.project.id, archived: true }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  await db
    .update(member)
    .set({ role: "owner" })
    .where(eq(member.id, membershipId));
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
