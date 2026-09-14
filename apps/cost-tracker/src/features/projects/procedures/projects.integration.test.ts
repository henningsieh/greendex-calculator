// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
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

import { PROJECT_SORT_MODES } from "@/features/projects/project-list-query-options";
import { resolveRelationship } from "@/features/projects/procedures/projects";
import { router } from "@/lib/orpc/router";

describe("projects procedures", () => {
  describe("get", () => {
const suffix = randomUUID();
const userId = `detail-user-${suffix}`;
const hostId = `detail-host-${suffix}`;
const partnerId = `detail-partner-${suffix}`;
const unrelatedId = `detail-unrelated-${suffix}`;
const projectId = `detail-project-${suffix}`;
const partnershipId = `detail-partnership-${suffix}`;
const assignedAt = new Date("2026-02-01T10:00:00.000Z");
const updatedAt = new Date("2026-02-02T10:00:00.000Z");
const headers = new Headers();
const client = createRouterClient(router, { context: async () => ({ headers }) });

function useSession(activeOrganizationId: string) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: { id: userId, name: "Detail User", email: `${userId}@example.com` },
  });
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Detail User",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: hostId, name: "Detail Host", slug: hostId, createdAt: now },
    { id: partnerId, name: "Detail Partner", slug: partnerId, createdAt: now },
    {
      id: unrelatedId,
      name: "Detail Unrelated",
      slug: unrelatedId,
      createdAt: now,
    },
  ]);
  await db.insert(projectsTable).values({
    id: projectId,
    name: "Detail Project",
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate: new Date("2026-08-03T00:00:00.000Z"),
    location: "Prague",
    country: "CZ",
    responsibleUserId: userId,
    organizationId: hostId,
    costSubmissionWindowOpen: true,
  });
  await db.insert(projectPartnerOrganizationsTable).values({
    id: partnershipId,
    projectId,
    organizationId: partnerId,
    createdAt: assignedAt,
    updatedAt,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  useSession(hostId);
});

afterAll(async () => {
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(inArray(projectPartnerOrganizationsTable.id, [partnershipId]));
  await db.delete(projectsTable).where(inArray(projectsTable.id, [projectId]));
  await db
    .delete(organization)
    .where(inArray(organization.id, [hostId, partnerId, unrelatedId]));
  await db.delete(user).where(inArray(user.id, [userId]));
});
  it("returns the Hosted-safe workspace shell", async () => {
    const detail = await client.projects.get({ projectId });

    expect(detail).toMatchObject({
      id: projectId,
      relationship: "hosted",
      name: "Detail Project",
      costSubmissionWindowOpen: true,
      partnerOrganizations: [
        {
          id: partnershipId,
          organizationId: partnerId,
          organizationName: "Detail Partner",
          assignedAt,
          updatedAt,
        },
      ],
    });
    expect(detail).not.toHaveProperty("responsibleUserId");
  });

  it("returns only the active Partner assignment and Hosting identity", async () => {
    useSession(partnerId);

    const detail = await client.projects.get({ projectId });

    expect(detail).toMatchObject({
      id: projectId,
      relationship: "partner",
      hostingOrganization: { id: hostId, name: "Detail Host" },
      partnership: { id: partnershipId, assignedAt, updatedAt },
    });
    expect(detail).not.toHaveProperty("partnerOrganizations");
    expect(detail).not.toHaveProperty("amount");
  });

  it("returns FORBIDDEN for an inaccessible Project", async () => {
    useSession(unrelatedId);

    await expect(client.projects.get({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("requires the relationship-specific Better Auth permission", async () => {
    useSession(partnerId);
    authMocks.hasPermission.mockImplementation(
      async ({ body }: { body: { permissions: object } }) => ({
        success: !Object.hasOwn(body.permissions, "projectPartnership"),
      }),
    );

    await expect(client.projects.get({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    authMocks.getSession.mockResolvedValue(null);

    await expect(client.projects.get({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  });

  describe("list", () => {
const suffix = randomUUID();
const userId = `list-user-${suffix}`;
const hostId = `list-host-${suffix}`;
const foreignHostId = `list-foreign-host-${suffix}`;
const partnerId = `list-partner-${suffix}`;
const secondPartnerId = `list-second-partner-${suffix}`;
const unrelatedId = `list-unrelated-${suffix}`;
const alphaId = `list-alpha-${suffix}`;
const betaId = `list-beta-${suffix}`;
const climateId = `list-climate-${suffix}`;
const foreignId = `list-foreign-${suffix}`;
const archivedId = `list-archived-${suffix}`;
const generatedIds = Array.from(
  { length: 26 },
  (_, index) => `list-generated-${index.toString().padStart(2, "0")}-${suffix}`,
);
const projectIds = [
  alphaId,
  betaId,
  climateId,
  foreignId,
  archivedId,
  ...generatedIds,
];
const partnershipIds = [
  `list-link-alpha-${suffix}`,
  `list-link-alpha-second-${suffix}`,
  `list-link-beta-${suffix}`,
  `list-link-foreign-${suffix}`,
  ...generatedIds.map((id) => `list-link-${id}`),
];
const headers = new Headers();
const client = createRouterClient(router, { context: async () => ({ headers }) });

function getGeneratedDate(index: number) {
  const day = index === 1 ? 1 : index === 22 ? 22 : index + 1;
  return new Date(Date.UTC(2027, 0, day));
}

function useActiveOrganization(activeOrganizationId: string) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: { id: userId, name: "List User", email: `${userId}@example.com` },
  });
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "List User",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: hostId, name: "List Host", slug: hostId, createdAt: now },
    {
      id: foreignHostId,
      name: "List Foreign Host",
      slug: foreignHostId,
      createdAt: now,
    },
    { id: partnerId, name: "List Partner", slug: partnerId, createdAt: now },
    {
      id: secondPartnerId,
      name: "List Second Partner",
      slug: secondPartnerId,
      createdAt: now,
    },
    {
      id: unrelatedId,
      name: "List Unrelated",
      slug: unrelatedId,
      createdAt: now,
    },
  ]);
  await db.insert(projectsTable).values([
    {
      id: alphaId,
      name: "Alpha Open Workshop",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-03T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      responsibleUserId: userId,
      organizationId: hostId,
      costSubmissionWindowOpen: true,
    },
    {
      id: betaId,
      name: "Beta Closed Forum",
      startDate: new Date("2026-06-03T00:00:00.000Z"),
      endDate: new Date("2026-06-05T00:00:00.000Z"),
      location: "Paris",
      country: "FR",
      responsibleUserId: userId,
      organizationId: hostId,
    },
    {
      id: climateId,
      name: "Climate Assembly",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-05T00:00:00.000Z"),
      location: "Vienna",
      country: "AT",
      responsibleUserId: userId,
      organizationId: hostId,
      costSubmissionWindowOpen: true,
    },
    {
      id: foreignId,
      name: "Foreign Partner Project",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-02T00:00:00.000Z"),
      location: "Rome",
      country: "IT",
      responsibleUserId: userId,
      organizationId: foreignHostId,
      costSubmissionWindowOpen: true,
    },
    {
      id: archivedId,
      name: "Archived Project",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-02T00:00:00.000Z"),
      location: "Madrid",
      country: "ES",
      responsibleUserId: userId,
      organizationId: hostId,
      archived: true,
    },
    ...generatedIds.map((id, index) => ({
      id,
      name: `Generated Project ${index.toString().padStart(2, "0")}`,
      startDate: getGeneratedDate(index),
      endDate: new Date(getGeneratedDate(index).getTime() + 86_400_000),
      location: "Brussels",
      country: "BE" as const,
      responsibleUserId: userId,
      organizationId: hostId,
    })),
  ]);
  await db.insert(projectPartnerOrganizationsTable).values([
    { id: partnershipIds[0]!, projectId: alphaId, organizationId: partnerId },
    {
      id: partnershipIds[1]!,
      projectId: alphaId,
      organizationId: secondPartnerId,
    },
    { id: partnershipIds[2]!, projectId: betaId, organizationId: partnerId },
    { id: partnershipIds[3]!, projectId: foreignId, organizationId: partnerId },
    ...generatedIds.map((projectId, index) => ({
      id: partnershipIds[index + 4]!,
      projectId,
      organizationId: partnerId,
    })),
  ]);
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  useActiveOrganization(hostId);
});

afterAll(async () => {
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(inArray(projectPartnerOrganizationsTable.id, partnershipIds));
  await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [
        hostId,
        foreignHostId,
        partnerId,
        secondPartnerId,
        unrelatedId,
      ]),
    );
  await db.delete(user).where(inArray(user.id, [userId]));
});
  it("returns a bounded Hosted page with whole-scope metrics", async () => {
    const result = await client.projects.listHosted({ pageSize: 25 });

    expect(result.scope).toBe("hosted");
    expect(result.rows).toHaveLength(25);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(result.metrics.whole).toEqual({
      projectCount: 29,
      openWindowCount: 2,
      partnerOrganizationCount: 2,
    });
    expect(result.metrics.filtered).toEqual(result.metrics.whole);
    expect(result.rows.slice(0, 3).map((project) => project.id)).toEqual([
      alphaId,
      climateId,
      betaId,
    ]);
    expect(result.rows[0]).not.toHaveProperty("organizationId");

    const largerPage = await client.projects.listHosted({ pageSize: 50 });
    expect(largerPage.metrics).toEqual(result.metrics);
  });

  it.each(PROJECT_SORT_MODES)(
    "provides stable bidirectional %s cursors for Hosted and Partner Projects",
    async (sort) => {
      for (const [scope, activeOrganizationId] of [
        ["hosted", hostId],
        ["partner", partnerId],
      ] as const) {
        useActiveOrganization(activeOrganizationId);
        const getListPage = (cursor?: string) =>
          scope === "hosted"
            ? client.projects.listHosted({ pageSize: 25, sort, cursor })
            : client.projects.listPartner({ pageSize: 25, sort, cursor });
        const first = await getListPage();
        const second = await getListPage(first.nextCursor);

        expect(first.previousCursor).toBeUndefined();
        expect(first.nextCursor).toEqual(expect.any(String));
        expect(second.rows).toHaveLength(4);
        expect(second.previousCursor).toEqual(expect.any(String));
        expect(second.nextCursor).toBeUndefined();
        expect(second.metrics).toEqual(first.metrics);
        expect(
          new Set([...first.rows, ...second.rows].map((project) => project.id))
            .size,
        ).toBe(29);

        const previous = await getListPage(second.previousCursor);
        expect(previous.rows.map((project) => project.id)).toEqual(
          first.rows.map((project) => project.id),
        );
        expect(previous.previousCursor).toBeUndefined();
        expect(previous.nextCursor).toEqual(expect.any(String));
      }
    },
  );

  it("recovers at the first page when a cursor protocol version is unsupported", async () => {
    const first = await client.projects.listHosted({ pageSize: 25 });
    const staleCursor = Buffer.from(JSON.stringify({ version: 1 })).toString(
      "base64url",
    );

    const recovered = await client.projects.listHosted({
      pageSize: 25,
      cursor: staleCursor,
    });

    expect(recovered.rows.map((project) => project.id)).toEqual(
      first.rows.map((project) => project.id),
    );
    expect(recovered.previousCursor).toBeUndefined();
  });

  it("rejects a cursor when its scope, search, filters, sort, or page size change", async () => {
    await expect(
      client.projects.listHosted({
        pageSize: 25,
        cursor: "not-a-valid-cursor",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const first = await client.projects.listHosted({ pageSize: 25 });

    await expect(
      client.projects.listHosted({
        pageSize: 25,
        cursor: first.nextCursor,
        window: "open",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({
        pageSize: 25,
        cursor: first.nextCursor,
        search: "alpha",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({
        pageSize: 25,
        cursor: first.nextCursor,
        partnerOrganizationIds: [partnerId],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({
        pageSize: 25,
        cursor: first.nextCursor,
        sort: "end-desc",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({
        pageSize: 50,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    useActiveOrganization(partnerId);
    await expect(
      client.projects.listPartner({
        pageSize: 25,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("applies normalized name, window, overlap-date, and match-any Partner filters", async () => {
    const literalWildcards = await client.projects.listHosted({
      pageSize: 25,
      search: "%__",
    });
    expect(literalWildcards.rows).toEqual([]);

    const result = await client.projects.listHosted({
      pageSize: 25,
      search: "  alpha ",
      window: "open",
      dateFrom: new Date("2026-06-03T00:00:00.000Z"),
      dateTo: new Date("2026-06-03T00:00:00.000Z"),
      partnerOrganizationIds: [secondPartnerId, unrelatedId],
    });

    expect(result.rows.map((project) => project.id)).toEqual([alphaId]);
    expect(result.metrics.filtered).toEqual({
      projectCount: 1,
      openWindowCount: 1,
      partnerOrganizationCount: 2,
    });
    expect(result.metrics.whole.projectCount).toBe(29);
    expect(result.partnerOptions.map((partner) => partner.id)).toEqual([
      partnerId,
      secondPartnerId,
    ]);

    const largerPage = await client.projects.listHosted({
      pageSize: 50,
      search: "  alpha ",
      window: "open",
      dateFrom: new Date("2026-06-03T00:00:00.000Z"),
      dateTo: new Date("2026-06-03T00:00:00.000Z"),
      partnerOrganizationIds: [secondPartnerId, unrelatedId],
    });
    expect(largerPage.metrics).toEqual(result.metrics);
  });

  it("rejects malformed list input", async () => {
    await expect(
      client.projects.listHosted({ pageSize: 10 as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({ pageSize: 25, search: "ab" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({
        pageSize: 25,
        dateFrom: new Date("2026-07-01T00:00:00.000Z"),
        dateTo: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns only Partner-assigned Projects through the Partner-safe contract", async () => {
    useActiveOrganization(partnerId);

    const result = await client.projects.listPartner({ pageSize: 100 });

    expect(result.scope).toBe("partner");
    expect(result.rows).toHaveLength(29);
    expect(result.rows.slice(0, 3).map((project) => project.id)).toEqual([
      foreignId,
      alphaId,
      betaId,
    ]);
    expect(result.metrics.whole).toEqual({
      projectCount: 29,
      openWindowCount: 2,
    });
    expect(result).not.toHaveProperty("partnerOptions");
    for (const row of result.rows) {
      expect(row).not.toHaveProperty("organizationId");
      expect(row).not.toHaveProperty("partnerOrganizations");
      expect(row).not.toHaveProperty("responsibleUserId");
      expect(row).not.toHaveProperty("amount");
    }
  });

  it("reports permission-aware scope availability", async () => {
    expect(await client.projects.scopes()).toEqual({
      hosted: true,
      partner: false,
    });

    useActiveOrganization(partnerId);
    expect(await client.projects.scopes()).toEqual({
      hosted: false,
      partner: true,
    });

    useActiveOrganization(unrelatedId);
    expect(await client.projects.scopes()).toEqual({
      hosted: false,
      partner: false,
    });
  });
  });

  describe("relationship", () => {
const suffix = randomUUID();
const userId = `relationship-user-${suffix}`;
const hostingOrganizationId = `relationship-host-${suffix}`;
const partnerOrganizationId = `relationship-partner-${suffix}`;
const unrelatedOrganizationId = `relationship-unrelated-${suffix}`;
const projectId = `relationship-project-${suffix}`;
const archivedProjectId = `relationship-archived-${suffix}`;
const partnershipId = `relationship-partnership-${suffix}`;

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Relationship Test User",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    {
      id: hostingOrganizationId,
      name: "Relationship Hosting Organization",
      slug: hostingOrganizationId,
      createdAt: now,
    },
    {
      id: partnerOrganizationId,
      name: "Relationship Partner Organization",
      slug: partnerOrganizationId,
      createdAt: now,
    },
    {
      id: unrelatedOrganizationId,
      name: "Relationship Unrelated Organization",
      slug: unrelatedOrganizationId,
      createdAt: now,
    },
  ]);
  await db.insert(projectsTable).values([
    {
      id: projectId,
      name: "Relationship Project",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-03T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      responsibleUserId: userId,
      organizationId: hostingOrganizationId,
    },
    {
      id: archivedProjectId,
      name: "Archived Relationship Project",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-03T00:00:00.000Z"),
      location: "Paris",
      country: "FR",
      responsibleUserId: userId,
      organizationId: hostingOrganizationId,
      archived: true,
    },
  ]);
  await db.insert(projectPartnerOrganizationsTable).values({
    id: partnershipId,
    projectId,
    organizationId: partnerOrganizationId,
  });
});

afterAll(async () => {
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(eq(projectPartnerOrganizationsTable.id, partnershipId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, archivedProjectId));
  await db.delete(organization).where(eq(organization.id, hostingOrganizationId));
  await db.delete(organization).where(eq(organization.id, partnerOrganizationId));
  await db
    .delete(organization)
    .where(eq(organization.id, unrelatedOrganizationId));
  await db.delete(user).where(eq(user.id, userId));
});
  it("resolves the Hosting Organization relationship", async () => {
    await expect(
      resolveRelationship({
        activeOrganizationId: hostingOrganizationId,
        projectId,
      }),
    ).resolves.toMatchObject({ kind: "hosted", projectId, archived: false });
  });

  it("resolves the assigned Partner Organization relationship", async () => {
    await expect(
      resolveRelationship({
        activeOrganizationId: partnerOrganizationId,
        projectId,
      }),
    ).resolves.toMatchObject({
      kind: "partner",
      projectId,
      partnershipId,
      archived: false,
    });
  });

  it("returns inaccessible for an unrelated Organization or missing Project", async () => {
    await expect(
      resolveRelationship({
        activeOrganizationId: unrelatedOrganizationId,
        projectId,
      }),
    ).resolves.toEqual({ kind: "inaccessible" });
    await expect(
      resolveRelationship({
        activeOrganizationId: hostingOrganizationId,
        projectId: "missing-project",
      }),
    ).resolves.toEqual({ kind: "inaccessible" });
  });

  it("preserves archived state for detail authorization", async () => {
    await expect(
      resolveRelationship({
        activeOrganizationId: hostingOrganizationId,
        projectId: archivedProjectId,
      }),
    ).resolves.toMatchObject({
      kind: "hosted",
      projectId: archivedProjectId,
      archived: true,
    });
  });
  });
});
