// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { hashPassword } from "better-auth/crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({ emailSender: {} }));

import {
  archiveProject,
  reopenProject,
} from "@/features/projects/procedures/archive";
import { auth } from "@/lib/auth";

const organizationId = randomUUID();
const projectId = randomUUID();
const password = randomUUID();
const actors = [
  { id: randomUUID(), role: ORGANIZATION_ROLES.OrganizationOwner, allowed: true },
  { id: randomUUID(), role: ORGANIZATION_ROLES.OrganizationAdmin, allowed: true },
  {
    id: randomUUID(),
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    allowed: false,
  },
  { id: randomUUID(), role: ORGANIZATION_ROLES.Participant, allowed: false },
];
const email = (id: string) => `${id}@example.invalid`;

beforeAll(async () => {
  await db.insert(organization).values({
    id: organizationId,
    name: "Reopen permission test",
    slug: `reopen-${organizationId}`,
    country: "DE",
    createdAt: new Date(),
  });
  await db.insert(user).values(
    actors.map(({ id }) => ({
      id,
      name: "Test user",
      email: email(id),
      emailVerified: true,
    })),
  );
  const hashed = await hashPassword(password);
  await db.insert(account).values(
    actors.map(({ id }) => ({
      id: randomUUID(),
      accountId: id,
      userId: id,
      providerId: "credential",
      password: hashed,
    })),
  );
  await db.insert(member).values(
    actors.map(({ id, role }) => ({
      id: randomUUID(),
      userId: id,
      organizationId,
      role,
      createdAt: new Date(),
    })),
  );
  await db.insert(projectsTable).values({
    id: projectId,
    organizationId,
    name: "Reopen test",
    location: "Berlin",
    country: "DE",
    startDate: new Date(),
    endDate: new Date(),
  });
});

afterAll(async () => {
  const ids = actors.map(({ id }) => id);
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(session).where(inArray(session.userId, ids));
  await db.delete(member).where(eq(member.organizationId, organizationId));
  await db.delete(account).where(inArray(account.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
  await db.delete(organization).where(eq(organization.id, organizationId));
});

describe("Project reopen permission through Better Auth", () => {
  it.each(actors)("checks $role", async ({ id, allowed }) => {
    const response = await auth.api.signInEmail({
      body: { email: email(id), password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not return a session cookie");
    const headers = new Headers({ cookie });
    await auth.api.setActiveOrganization({ headers, body: { organizationId } });
    expect(
      await auth.api.hasPermission({
        headers,
        body: { permissions: { project: ["reopen"] } },
      }),
    ).toMatchObject({ success: allowed });
  });

  it("allows the owner through the real archive and reopen procedure boundary", async () => {
    const owner = actors[0]!;
    const response = await auth.api.signInEmail({
      body: { email: email(owner.id), password },
      asResponse: true,
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Sign-in did not return a session cookie");
    const headers = new Headers({ cookie });
    await auth.api.setActiveOrganization({ headers, body: { organizationId } });
    const client = createRouterClient(
      { archiveProject, reopenProject },
      { context: async () => ({ headers }) },
    );
    expect(await client.archiveProject({ projectId })).toEqual({
      projectId,
      archived: true,
    });
    expect(
      await client.reopenProject({ projectId, reason: "Correct administration" }),
    ).toEqual({ projectId, archived: false });
  });
});
