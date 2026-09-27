// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  member,
  organization,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  afterAll,
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
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const actor = `create-actor-${suffix}`;
const host = `create-host-${suffix}`;
const otherHost = `create-other-host-${suffix}`;
const foreignProject = `create-foreign-project-${suffix}`;
const unassignedProject = `create-unassigned-project-${suffix}`;
const input = {
  name: "New Workshop",
  startDate: new Date("2027-04-01T00:00:00.000Z"),
  endDate: new Date("2027-04-03T00:00:00.000Z"),
  location: "Berlin",
  country: "DE" as const,
  welcomeMessage: "Welcome!",
};
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function session(activeOrganizationId: string | null, userId = actor) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: { id: userId, name: "Creator", email: `${actor}@example.org` },
  });
}

async function role() {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, actor), eq(member.organizationId, host)));
  return row?.role;
}

async function assignments() {
  return db
    .select({ projectId: hostProjectAssignmentsTable.projectId })
    .from(hostProjectAssignmentsTable)
    .where(eq(hostProjectAssignmentsTable.userId, actor));
}

describe("projects.create", () => {
  beforeAll(async () => {
    const now = new Date();
    await db.insert(user).values({
      id: actor,
      name: "Creator",
      email: `${actor}@example.org`,
      emailVerified: true,
    });
    await db.insert(organization).values(
      [host, otherHost].map((id) => ({
        id,
        name: id,
        slug: id,
        createdAt: now,
      })),
    );
    await db.insert(member).values({
      id: randomUUID(),
      userId: actor,
      organizationId: host,
      role: "member,participant",
      createdAt: now,
    });
    await db.insert(projectsTable).values([
      {
        ...input,
        id: foreignProject,
        name: "Foreign workshop",
        organizationId: otherHost,
      },
      {
        ...input,
        id: unassignedProject,
        name: "Unassigned workshop",
        organizationId: host,
      },
    ]);
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    session(host);
    authMocks.hasPermission.mockResolvedValue({ success: false });
    await db
      .update(member)
      .set({ role: "member,participant" })
      .where(and(eq(member.userId, actor), eq(member.organizationId, host)));
    await db
      .delete(projectsTable)
      .where(
        and(
          eq(projectsTable.organizationId, host),
          eq(projectsTable.name, input.name),
        ),
      );
  });
  afterAll(async () => {
    await db
      .delete(projectsTable)
      .where(inArray(projectsTable.organizationId, [host, otherHost]));
    await db.delete(member).where(eq(member.userId, actor));
    await db
      .delete(organization)
      .where(inArray(organization.id, [host, otherHost]));
    await db.delete(user).where(eq(user.id, actor));
  });

  it("upgrades a host member without removing roles and assigns only created Projects", async () => {
    const first = await client.projects.create(input);
    expect(first).toEqual({ id: expect.any(String) });
    expect(await role()).toBe("member,participant,project-coordinator");
    expect(await assignments()).toEqual([{ projectId: first.id }]);
    await expect(
      requireHostCoordination(first.id, actor, host, {
        FORBIDDEN: ({ message }) => new Error(message),
      }),
    ).resolves.toBeDefined();
    expect(await client.projects.get({ projectId: first.id })).toMatchObject({
      id: first.id,
      relationship: "hosted",
    });
    authMocks.hasPermission.mockResolvedValue({ success: true });
    await expect(
      client.projects.get({ projectId: unassignedProject }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.projects.get({ projectId: foreignProject }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    authMocks.hasPermission.mockResolvedValue({ success: false });
    await expect(
      requireHostCoordination(foreignProject, actor, otherHost, {
        FORBIDDEN: ({ message }) => new Error(message),
      }),
    ).rejects.toThrow();
    const second = await client.projects.create(input);
    expect(await role()).toBe("member,participant,project-coordinator");
    expect(
      (await assignments()).map(({ projectId }) => projectId).sort(),
    ).toEqual([first.id, second.id].sort());
    await db
      .delete(hostProjectAssignmentsTable)
      .where(eq(hostProjectAssignmentsTable.projectId, first.id));
    await expect(
      client.projects.get({ projectId: first.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["owner", "admin"])(
    "keeps %s role while assigning the creator",
    async (membershipRole) => {
      await db
        .update(member)
        .set({ role: membershipRole })
        .where(eq(member.userId, actor));
      const result = await client.projects.create(input);
      expect(await role()).toBe(membershipRole);
      expect(await assignments()).toEqual([{ projectId: result.id }]);
    },
  );

  it("rejects absent membership, wrong active Organization, no active Organization and unauthenticated calls without writes", async () => {
    session(otherHost);
    await expect(client.projects.create(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    session(null);
    await expect(client.projects.create(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    session(host, "not-a-member");
    await expect(client.projects.create(input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    authMocks.getSession.mockResolvedValue(null);
    await expect(client.projects.create(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await assignments()).toEqual([]);
    expect(await role()).toBe("member,participant");
  });

  it("rejects invalid details and server-owned fields", async () => {
    await expect(
      client.projects.create({ ...input, country: "US" as "DE" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.create({ ...input, endDate: new Date("2027-03-01") }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.create({
        ...input,
        organizationId: otherHost,
      } as typeof input),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await assignments()).toEqual([]);
  });
});
