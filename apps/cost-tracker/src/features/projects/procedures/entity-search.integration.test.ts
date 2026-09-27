// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as assignments,
  member,
  organization,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { inArray } from "drizzle-orm";
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

import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const actor = `picker-user-${suffix}`;
const host = `picker-host-${suffix}`;
const partner = `picker-partner-${suffix}`;
const foreign = `picker-foreign-${suffix}`;
const assigned = `picker-assigned-${suffix}`;
const unassigned = `picker-unassigned-${suffix}`;
const foreignProject = `picker-foreign-project-${suffix}`;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function session(activeOrganizationId: string | null = host) {
  authMocks.getSession.mockResolvedValue({
    session: { id: actor, userId: actor, activeOrganizationId },
    user: { id: actor, email: `${actor}@example.com` },
  });
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: actor,
    name: "Picker User",
    email: `${actor}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: host, name: `Host ${suffix}`, slug: host, createdAt: now },
    { id: partner, name: `Partner ${suffix}`, slug: partner, createdAt: now },
    { id: foreign, name: `Foreign ${suffix}`, slug: foreign, createdAt: now },
  ]);
  await db.insert(member).values([
    {
      id: randomUUID(),
      organizationId: host,
      userId: actor,
      role: "owner",
      createdAt: now,
    },
    {
      id: randomUUID(),
      organizationId: partner,
      userId: actor,
      role: "member,owner",
      createdAt: now,
    },
    {
      id: randomUUID(),
      organizationId: foreign,
      userId: actor,
      role: "member",
      createdAt: now,
    },
  ]);
  await db.insert(projects).values(
    [assigned, unassigned, foreignProject].map((id) => ({
      id,
      name: `Project ${id}`,
      organizationId: id === foreignProject ? foreign : host,
      startDate: now,
      endDate: now,
      location: "Berlin",
      country: "DE" as const,
    })),
  );
  await db.insert(assignments).values({ projectId: assigned, userId: actor });
});

afterAll(async () => {
  await db
    .delete(projects)
    .where(inArray(projects.id, [assigned, unassigned, foreignProject]));
  await db
    .delete(member)
    .where(inArray(member.organizationId, [host, partner, foreign]));
  await db
    .delete(organization)
    .where(inArray(organization.id, [host, partner, foreign]));
  await db.delete(user).where(inArray(user.id, [actor]));
});

beforeEach(() => {
  vi.clearAllMocks();
  session();
  authMocks.hasPermission.mockResolvedValue({ success: true });
});

describe("entity picker procedures", () => {
  it("searches Organizations by ID or name with id/name projection and create permission", async () => {
    expect(
      await client.organizations.search({ search: partner.slice(0, 12) }),
    ).toEqual([{ id: partner, name: `Partner ${suffix}` }]);
    expect(
      await client.organizations.search({ search: `Partner ${suffix}` }),
    ).toEqual([{ id: partner, name: `Partner ${suffix}` }]);
    expect(await client.organizations.search({ search: "%_" })).toEqual([]);
    await expect(
      client.organizations.search({ search: "p" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    authMocks.hasPermission.mockResolvedValue({ success: false });
    await expect(
      client.organizations.search({ search: "Part" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    session(null);
    await expect(
      client.organizations.search({ search: "Part" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("caps Organization search at 20 id/name matches", async () => {
    const matches = Array.from({ length: 22 }, (_, index) => ({
      id: `picker-result-${index}-${suffix}`,
      name: `Searchable ${suffix} ${index}`,
      slug: `picker-result-${index}-${suffix}`,
      createdAt: new Date(),
    }));
    await db.insert(organization).values(matches);
    try {
      const result = await client.organizations.search({
        search: `Searchable ${suffix}`,
      });
      expect(result).toHaveLength(20);
      expect(
        result.every((item) => Object.keys(item).sort().join() === "id,name"),
      ).toBe(true);
    } finally {
      await db.delete(organization).where(
        inArray(
          organization.id,
          matches.map(({ id }) => id),
        ),
      );
    }
  });

  it("limits own Organizations to owner memberships", async () => {
    expect(await client.organizations.listMine()).toEqual([
      { id: host, name: `Host ${suffix}` },
      { id: partner, name: `Partner ${suffix}` },
    ]);
  });

  it("scopes hosted search by active host membership and coordinator assignment", async () => {
    expect(await client.projects.searchHosted({ search: "picker-" })).toEqual([
      { id: assigned, name: `Project ${assigned}` },
      { id: unassigned, name: `Project ${unassigned}` },
    ]);
    await db
      .update(member)
      .set({ role: "project-coordinator" })
      .where(inArray(member.organizationId, [host]));
    try {
      expect(await client.projects.searchHosted({ search: "picker-" })).toEqual([
        { id: assigned, name: `Project ${assigned}` },
      ]);
      await expect(
        client.projects.searchHosted({ search: "x" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      session(foreign);
      await expect(
        client.projects.searchHosted({ search: "picker-" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await db
        .update(member)
        .set({ role: "owner" })
        .where(inArray(member.organizationId, [host]));
    }
  });
});
