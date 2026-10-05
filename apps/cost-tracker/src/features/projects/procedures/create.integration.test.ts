// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  member,
  organization,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { ORPCError, createRouterClient } from "@orpc/server";
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

import { requireCostTrackerRole } from "@/features/organizations/roles";
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
      [host, otherHost].map((id) => ({ country: "DE" as const,
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
      role: ORGANIZATION_ROLES.Participant,
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
      .set({ role: ORGANIZATION_ROLES.Participant })
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

  it("adds coordination to a Participant without removing roles and assigns only created Projects", async () => {
    // ADR-0012: fallback roles are refused in memory, never seeded or upgraded.
    for (const bannedRole of ["invalid-role", "invalid-role,participant"]) {
      let refusal: unknown;
      try {
        requireCostTrackerRole(
          bannedRole,
          (options) => new ORPCError("BAD_REQUEST", options),
        );
      } catch (error) {
        refusal = error;
      }
      expect(refusal).toMatchObject({
        code: "BAD_REQUEST",
        status: 400,
        message:
          "Use a defined Organization role.",
      });
    }
    const first = await client.projects.create(input);
    expect(first).toEqual({ id: expect.any(String) });
    expect(await role()).toBe(`${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`);
    expect(await assignments()).toEqual([{ projectId: first.id }]);
    await expect(
      requireHostCoordination(first.id, actor, host, {
        FORBIDDEN: (options) => new ORPCError("FORBIDDEN", options),
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
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Project not found in scope.",
      data: { reason: "PROJECT_NOT_FOUND" },
    });
    authMocks.hasPermission.mockResolvedValue({ success: false });
    await expect(
      requireHostCoordination(foreignProject, actor, otherHost, {
        FORBIDDEN: (options) => new ORPCError("FORBIDDEN", options),
      }),
    ).rejects.toThrow();
    await expect(
      requireHostCoordination(unassignedProject, actor, host, {
        FORBIDDEN: (options) => new ORPCError("FORBIDDEN", options),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message:
        "You need Hosting Organization staff access or an assignment to this Project.",
      data: { reason: "HOST_COORDINATION_REQUIRED" },
    });
    const second = await client.projects.create(input);
    expect(await role()).toBe(`${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`);
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

  it("distinguishes missing selection, membership, and scoped Project in the shared Hosting guard", async () => {
    const errors = {
      FORBIDDEN: (options: { message: string; data?: { reason: string } }) =>
        new ORPCError("FORBIDDEN", options),
    };
    await expect(
      requireHostCoordination("missing", actor, null, errors),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message:
        "Select an active Organization before accessing Cost Tracker data.",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    await expect(
      requireHostCoordination("missing", "not-a-member", host, errors),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Membership in the active Organization is required.",
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
    await expect(
      requireHostCoordination("missing", actor, host, errors),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Project not found in scope.",
      data: { reason: "PROJECT_NOT_FOUND" },
    });
    expect(await assignments()).toEqual([]);
  });

  it.each([ORGANIZATION_ROLES.OrganizationOwner, ORGANIZATION_ROLES.OrganizationAdmin])(
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
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
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
    expect(await role()).toBe(ORGANIZATION_ROLES.Participant);
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
