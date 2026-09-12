import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
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

import { PROJECT_SORT_MODES } from "@/features/projects/collection-state";
import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const userId = `overview-user-${suffix}`;
const hostId = `overview-host-${suffix}`;
const foreignHostId = `overview-foreign-host-${suffix}`;
const partnerId = `overview-partner-${suffix}`;
const secondPartnerId = `overview-second-partner-${suffix}`;
const unrelatedId = `overview-unrelated-${suffix}`;
const alphaId = `overview-alpha-${suffix}`;
const betaId = `overview-beta-${suffix}`;
const climateId = `overview-climate-${suffix}`;
const foreignId = `overview-foreign-${suffix}`;
const archivedId = `overview-archived-${suffix}`;
const generatedIds = Array.from(
  { length: 26 },
  (_, index) =>
    `overview-generated-${index.toString().padStart(2, "0")}-${suffix}`,
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
  `overview-link-alpha-${suffix}`,
  `overview-link-alpha-second-${suffix}`,
  `overview-link-beta-${suffix}`,
  `overview-link-foreign-${suffix}`,
  ...generatedIds.map((id) => `overview-link-${id}`),
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
    user: { id: userId, name: "Overview User", email: `${userId}@example.com` },
  });
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Overview User",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: hostId, name: "Overview Host", slug: hostId, createdAt: now },
    {
      id: foreignHostId,
      name: "Overview Foreign Host",
      slug: foreignHostId,
      createdAt: now,
    },
    { id: partnerId, name: "Overview Partner", slug: partnerId, createdAt: now },
    {
      id: secondPartnerId,
      name: "Overview Second Partner",
      slug: secondPartnerId,
      createdAt: now,
    },
    {
      id: unrelatedId,
      name: "Overview Unrelated",
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

describe("Project overview procedures", () => {
  it("returns a bounded Hosted page with whole-scope metrics", async () => {
    const result = await client.projects.hostedOverview({ pageSize: 25 });

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

    const largerPage = await client.projects.hostedOverview({ pageSize: 50 });
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
        const getOverviewPage = (cursor?: string) =>
          scope === "hosted"
            ? client.projects.hostedOverview({ pageSize: 25, sort, cursor })
            : client.projects.partnerOverview({ pageSize: 25, sort, cursor });
        const first = await getOverviewPage();
        const second = await getOverviewPage(first.nextCursor);

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

        const previous = await getOverviewPage(second.previousCursor);
        expect(previous.rows.map((project) => project.id)).toEqual(
          first.rows.map((project) => project.id),
        );
        expect(previous.previousCursor).toBeUndefined();
        expect(previous.nextCursor).toEqual(expect.any(String));
      }
    },
  );

  it("recovers at the first page when a cursor protocol version is unsupported", async () => {
    const first = await client.projects.hostedOverview({ pageSize: 25 });
    const staleCursor = Buffer.from(JSON.stringify({ version: 1 })).toString(
      "base64url",
    );

    const recovered = await client.projects.hostedOverview({
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
      client.projects.hostedOverview({
        pageSize: 25,
        cursor: "not-a-valid-cursor",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const first = await client.projects.hostedOverview({ pageSize: 25 });

    await expect(
      client.projects.hostedOverview({
        pageSize: 25,
        cursor: first.nextCursor,
        window: "open",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({
        pageSize: 25,
        cursor: first.nextCursor,
        search: "alpha",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({
        pageSize: 25,
        cursor: first.nextCursor,
        partnerOrganizationIds: [partnerId],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({
        pageSize: 25,
        cursor: first.nextCursor,
        sort: "end-desc",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({
        pageSize: 50,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    useActiveOrganization(partnerId);
    await expect(
      client.projects.partnerOverview({
        pageSize: 25,
        cursor: first.nextCursor,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("applies normalized name, window, overlap-date, and match-any Partner filters", async () => {
    const literalWildcards = await client.projects.hostedOverview({
      pageSize: 25,
      search: "%__",
    });
    expect(literalWildcards.rows).toEqual([]);

    const result = await client.projects.hostedOverview({
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

    const largerPage = await client.projects.hostedOverview({
      pageSize: 50,
      search: "  alpha ",
      window: "open",
      dateFrom: new Date("2026-06-03T00:00:00.000Z"),
      dateTo: new Date("2026-06-03T00:00:00.000Z"),
      partnerOrganizationIds: [secondPartnerId, unrelatedId],
    });
    expect(largerPage.metrics).toEqual(result.metrics);
  });

  it("rejects malformed collection input", async () => {
    await expect(
      client.projects.hostedOverview({ pageSize: 10 as never }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({ pageSize: 25, search: "ab" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.hostedOverview({
        pageSize: 25,
        dateFrom: new Date("2026-07-01T00:00:00.000Z"),
        dateTo: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns only Partner-assigned Projects through the Partner-safe contract", async () => {
    useActiveOrganization(partnerId);

    const result = await client.projects.partnerOverview({ pageSize: 100 });

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
    expect(await client.projects.availableScopes()).toEqual({
      hosted: true,
      partner: false,
    });

    useActiveOrganization(partnerId);
    expect(await client.projects.availableScopes()).toEqual({
      hosted: false,
      partner: true,
    });

    useActiveOrganization(unrelatedId);
    expect(await client.projects.availableScopes()).toEqual({
      hosted: false,
      partner: false,
    });
  });
});
