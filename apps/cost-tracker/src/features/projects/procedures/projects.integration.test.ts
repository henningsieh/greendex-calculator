// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimsTable,
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  projectPartnerOrganizationsTable,
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

import { resolveRelationship } from "@/features/projects/procedures/projects";
import { PROJECT_SORT_MODES } from "@/features/projects/project-list-query-options";
import { router } from "@/lib/orpc/router";

describe("projects procedures", () => {
  describe("derived readiness and completion", () => {
    const suffix = randomUUID();
    const id = (name: string) => `readiness-${name}-${suffix}`;
    const actor = id("actor");
    const otherUser = id("other-user");
    const host = id("host");
    const partnerIds = [id("partner-a"), id("partner-b"), id("partner-c")];
    const projectId = id("project");
    const secondProjectId = id("other-project");
    const partnershipIds = [id("link-a"), id("link-b"), id("link-c")];
    const otherPartnershipId = id("other-link");
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const complete = () => client.projects.complete({ projectId });
    const setClaim = async (
      index: number,
      status:
        | "editable"
        | "submitted"
        | "correction_requested"
        | "approved"
        | "rejected"
        | "paid",
    ) => {
      await db
        .insert(claimsTable)
        .values({ partnershipId: partnershipIds[index]!, status })
        .onConflictDoUpdate({
          target: claimsTable.partnershipId,
          set: { status },
        });
    };
    const useSession = (organizationId: string) => {
      authMocks.getSession.mockResolvedValue({
        session: {
          id: randomUUID(),
          userId: actor,
          activeOrganizationId: organizationId,
        },
        user: {
          id: actor,
          name: "Readiness actor",
          email: `${actor}@example.org`,
        },
      });
    };

    beforeAll(async () => {
      const now = new Date();
      await db.insert(user).values(
        [actor, otherUser].map((userId) => ({
          id: userId,
          name: "Readiness actor",
          email: `${userId}@example.org`,
          emailVerified: true,
        })),
      );
      await db.insert(organization).values(
        [host, ...partnerIds].map((org) => ({
          id: org,
          name: org,
          slug: org,
          createdAt: now,
        })),
      );
      await db.insert(member).values(
        [host, ...partnerIds].map((org) => ({
          id: randomUUID(),
          organizationId: org,
          userId: actor,
          role: "owner",
          createdAt: now,
        })),
      );
      await db.insert(projectsTable).values(
        [projectId, secondProjectId].map((project) => ({
          id: project,
          name: project,
          startDate: now,
          endDate: now,
          location: "Riga",
          country: "LV" as const,
          organizationId: host,
        })),
      );
      await db.insert(hostAssignments).values(
        [projectId, secondProjectId].map((projectId) => ({
          projectId,
          userId: actor,
        })),
      );
      await db.insert(projectPartnerOrganizationsTable).values([
        ...partnershipIds.map((link, index) => ({
          id: link,
          projectId,
          organizationId: partnerIds[index]!,
        })),
        {
          id: otherPartnershipId,
          projectId: secondProjectId,
          organizationId: partnerIds[0]!,
        },
      ]);
    });
    beforeEach(async () => {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      useSession(host);
      await db
        .delete(claimsTable)
        .where(
          inArray(claimsTable.partnershipId, [
            ...partnershipIds,
            otherPartnershipId,
          ]),
        );
      await db
        .update(member)
        .set({ role: "owner" })
        .where(eq(member.organizationId, host));
      await db
        .update(projectsTable)
        .set({ completedAt: null, completedByUserId: null })
        .where(eq(projectsTable.id, projectId));
    });
    afterAll(async () => {
      await db
        .delete(claimsTable)
        .where(
          inArray(claimsTable.partnershipId, [
            ...partnershipIds,
            otherPartnershipId,
          ]),
        );
      await db
        .delete(projectPartnerOrganizationsTable)
        .where(
          inArray(projectPartnerOrganizationsTable.id, [
            ...partnershipIds,
            otherPartnershipId,
          ]),
        );
      await db
        .delete(projectsTable)
        .where(inArray(projectsTable.id, [projectId, secondProjectId]));
      await db.delete(member).where(eq(member.userId, actor));
      await db
        .delete(organization)
        .where(inArray(organization.id, [host, ...partnerIds]));
      await db.delete(user).where(inArray(user.id, [actor, otherUser]));
    });

    it("derives each Partnership's Claim state without mixing Projects or exposing other Partners", async () => {
      await setClaim(0, "correction_requested");
      await setClaim(1, "approved");
      await setClaim(2, "paid");
      await db
        .insert(claimsTable)
        .values({ partnershipId: otherPartnershipId, status: "rejected" });
      const hosted = await client.projects.get({ projectId });
      expect(hosted.relationship).toBe("hosted");
      if (hosted.relationship !== "hosted")
        throw new Error("Expected hosted Project");
      expect(
        hosted.partnerOrganizations.map((partner) => [
          partner.organizationId,
          partner.claimStatus,
        ]),
      ).toEqual([
        [partnerIds[0], "correction_requested"],
        [partnerIds[1], "approved"],
        [partnerIds[2], "paid"],
      ]);
      useSession(partnerIds[0]!);
      const partner = await client.projects.get({ projectId });
      expect(partner.relationship).toBe("partner");
      if (partner.relationship !== "partner")
        throw new Error("Expected Partner Project");
      expect(partner.partnership.claimStatus).toBe("correction_requested");
      expect(partner).not.toHaveProperty("partnerOrganizations");

      await setClaim(0, "rejected");
      const updated = await client.projects.get({ projectId });
      expect(updated.relationship).toBe("partner");
      if (updated.relationship !== "partner")
        throw new Error("Expected Partner Project");
      expect(updated.partnership.claimStatus).toBe("rejected");
    });

    it.each([
      "editable",
      "submitted",
      "correction_requested",
      "approved",
    ] as const)("blocks %s with the Partnership named", async (status) => {
      await setClaim(0, status);
      await setClaim(1, "paid");
      await setClaim(2, "rejected");
      await expect(complete()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining(partnerIds[0]),
      });
    });

    it("names claimless Partnerships even alongside non-terminal Claims", async () => {
      const claimless = await client.projects.get({ projectId });
      expect(claimless.relationship).toBe("hosted");
      if (claimless.relationship !== "hosted")
        throw new Error("Expected hosted Project");
      expect(
        claimless.partnerOrganizations.map(({ claimStatus }) => claimStatus),
      ).toEqual([null, null, null]);
      await setClaim(0, "submitted");
      await setClaim(1, "paid");
      await expect(complete()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining(partnerIds[0]),
      });
      await expect(complete()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining(partnerIds[2]),
      });
      await expect(complete()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("no Claim"),
      });
    });

    it("completes when every Partnership is paid or rejected, independently of another Project", async () => {
      await setClaim(0, "paid");
      await setClaim(1, "rejected");
      await setClaim(2, "paid");
      const result = await complete();
      expect(result).toMatchObject({
        projectId,
        completed: true,
        completedByUserId: actor,
        completedAt: expect.any(Date),
      });
      const [record] = await db
        .select({
          completedAt: projectsTable.completedAt,
          completedByUserId: projectsTable.completedByUserId,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(record).toEqual({
        completedAt: result.completedAt,
        completedByUserId: actor,
      });
      const detail = await client.projects.get({ projectId });
      expect(detail).toMatchObject({
        completedAt: result.completedAt,
        completedByUserId: actor,
      });
      useSession(partnerIds[0]!);
      expect(await client.projects.get({ projectId })).toMatchObject({
        relationship: "partner",
        completedAt: result.completedAt,
        completedByUserId: actor,
      });
      useSession(host);
      await expect(complete()).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const [unchanged] = await db
        .select({
          completedAt: projectsTable.completedAt,
          completedByUserId: projectsTable.completedByUserId,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(unchanged).toEqual(record);
    });

    it.each(["owner", "admin", "project-coordinator"])(
      "allows Hosting %s with organization-wide or explicit assignment authority",
      async (role) => {
        await db
          .update(member)
          .set({ role })
          .where(eq(member.organizationId, host));
        await setClaim(0, "paid");
        await setClaim(1, "rejected");
        await setClaim(2, "paid");
        if (role === "owner" || role === "admin") {
          await db
            .delete(hostAssignments)
            .where(eq(hostAssignments.projectId, projectId));
        }
        try {
          expect(await complete()).toMatchObject({
            projectId,
            completed: true,
            completedByUserId: actor,
            completedAt: expect.any(Date),
          });
        } finally {
          await db
            .insert(hostAssignments)
            .values({ projectId, userId: actor })
            .onConflictDoNothing();
        }
      },
    );

    it("denies assigned fallback members without the coordinator role", async () => {
      await db
        .update(member)
        .set({ role: "member" })
        .where(eq(member.organizationId, host));
      await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [record] = await db
        .select({ completedAt: projectsTable.completedAt })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(record?.completedAt).toBeNull();
    });

    it.each(["member", "participant", "project-coordinator"])(
      "denies Hosting %s without assignment",
      async (role) => {
        await db
          .update(member)
          .set({ role })
          .where(eq(member.organizationId, host));
        await db
          .delete(hostAssignments)
          .where(eq(hostAssignments.projectId, projectId));
        try {
          await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
        } finally {
          await db
            .insert(hostAssignments)
            .values({ projectId, userId: actor })
            .onConflictDoNothing();
        }
      },
    );

    it("denies Partner-side and unauthenticated completion", async () => {
      useSession(partnerIds[0]!);
      await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
      authMocks.getSession.mockResolvedValue(null);
      await expect(complete()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
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
    const client = createRouterClient(router, {
      context: async () => ({ headers }),
    });

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
        {
          id: partnerId,
          name: "Detail Partner",
          slug: partnerId,
          createdAt: now,
        },
        {
          id: unrelatedId,
          name: "Detail Unrelated",
          slug: unrelatedId,
          createdAt: now,
        },
      ]);
      await db.insert(member).values({
        id: randomUUID(),
        userId,
        organizationId: hostId,
        role: "owner",
        createdAt: now,
      });
      await db.insert(projectsTable).values({
        id: projectId,
        name: "Detail Project",
        startDate: new Date("2026-08-01T00:00:00.000Z"),
        endDate: new Date("2026-08-03T00:00:00.000Z"),
        location: "Prague",
        country: "CZ",
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
      await db
        .delete(projectsTable)
        .where(inArray(projectsTable.id, [projectId]));
      await db.delete(member).where(eq(member.userId, userId));
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
      expect(detail).not.toHaveProperty("hostAssignments");
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
      (_, index) =>
        `list-generated-${index.toString().padStart(2, "0")}-${suffix}`,
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
    const client = createRouterClient(router, {
      context: async () => ({ headers }),
    });

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
      await db.insert(member).values({
        id: randomUUID(),
        userId,
        organizationId: hostId,
        role: "owner",
        createdAt: now,
      });
      await db.insert(projectsTable).values([
        {
          id: alphaId,
          name: "Alpha Open Workshop",
          startDate: new Date("2026-06-01T00:00:00.000Z"),
          endDate: new Date("2026-06-03T00:00:00.000Z"),
          location: "Berlin",
          country: "DE",
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
          organizationId: hostId,
        },
        {
          id: climateId,
          name: "Climate Assembly",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-05T00:00:00.000Z"),
          location: "Vienna",
          country: "AT",
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
        {
          id: partnershipIds[3]!,
          projectId: foreignId,
          organizationId: partnerId,
        },
        ...generatedIds.map((projectId, index) => ({
          id: partnershipIds[index + 4]!,
          projectId,
          organizationId: partnerId,
        })),
      ]);
    });

    beforeEach(async () => {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      useActiveOrganization(hostId);
      await db
        .update(member)
        .set({ role: "owner" })
        .where(and(eq(member.userId, userId), eq(member.organizationId, hostId)));
    });

    afterAll(async () => {
      await db
        .delete(projectPartnerOrganizationsTable)
        .where(inArray(projectPartnerOrganizationsTable.id, partnershipIds));
      await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
      await db.delete(member).where(eq(member.userId, userId));
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
        expect(row).not.toHaveProperty("hostAssignments");
        expect(row).not.toHaveProperty("amount");
      }
    });

    it.each([
      "member",
      "participant",
      "project-coordinator",
      "member,participant,project-coordinator",
    ])(
      "denies org-wide hosted overview to %s even with project.read",
      async (role) => {
        await db
          .update(member)
          .set({ role })
          .where(
            and(eq(member.userId, userId), eq(member.organizationId, hostId)),
          );
        await expect(
          client.projects.listHosted({ pageSize: 25 }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await client.projects.scopes()).toEqual({
          hosted: false,
          partner: false,
          canCreate: true,
        });
      },
    );

    it("reports permission-aware scope availability", async () => {
      expect(await client.projects.scopes()).toEqual({
        hosted: true,
        partner: false,
        canCreate: true,
      });

      useActiveOrganization(partnerId);
      expect(await client.projects.scopes()).toEqual({
        hosted: false,
        partner: true,
        canCreate: false,
      });

      useActiveOrganization(unrelatedId);
      expect(await client.projects.scopes()).toEqual({
        hosted: false,
        partner: false,
        canCreate: false,
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
          organizationId: hostingOrganizationId,
        },
        {
          id: archivedProjectId,
          name: "Archived Relationship Project",
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-03T00:00:00.000Z"),
          location: "Paris",
          country: "FR",
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
      await db
        .delete(projectsTable)
        .where(eq(projectsTable.id, archivedProjectId));
      await db
        .delete(organization)
        .where(eq(organization.id, hostingOrganizationId));
      await db
        .delete(organization)
        .where(eq(organization.id, partnerOrganizationId));
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
