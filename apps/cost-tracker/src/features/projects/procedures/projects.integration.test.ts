// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import { claimsTable, projectsTable } from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { resolveRelationship } from "@/features/projects/procedures/projects";
import { PROJECT_SORT_MODES } from "@/features/projects/project-list-query-options";
import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerProjects.
describe("projects procedures", () => {
  describe("derived readiness and completion", () => {
    const suffix = "canonical";
    const id = (name: string) => `readiness-${name}-${suffix}`;
    let actor = id("actor");
    const host = id("host");
    const partnerIds = [id("partner-a"), id("partner-b"), id("partner-c")];
    let projectId: string;
    function useScenario(
      name:
        | "empty"
        | "mixed"
        | "claimless-partial"
        | "terminal"
        | "editable"
        | "submitted"
        | "correction_requested"
        | "approved",
    ) {
      projectId = id(`${name}-project`);
    }
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const complete = () => client.projects.complete({ projectId });
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

    beforeEach(async () => {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      actor = id("actor");
      useSession(host);
      useScenario("empty");
    });
    afterEach(async () => {
      // Completion is behavior under test; restore only its two output fields.
      await db
        .update(projectsTable)
        .set({ completedAt: null, completedByUserId: null })
        .where(eq(projectsTable.id, projectId));
    });

    it("derives each Partnership's Claim state without mixing Projects or exposing other Partners", async () => {
      useScenario("mixed");
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

      const baselineClaim = await db.query.claimsTable.findFirst({
        where: eq(claimsTable.partnershipId, id("mixed-link-a")),
      });
      if (!baselineClaim)
        throw new Error("Canonical mixed-status Claim required.");
      // Same-Project refresh after a Claim state change is under test. No supported
      // transition rejects a correction_requested Claim; restore this scoped write exactly.
      try {
        await db
          .update(claimsTable)
          .set({ status: "rejected" })
          .where(eq(claimsTable.id, baselineClaim.id));
        const updated = await client.projects.get({ projectId });
        expect(updated.relationship).toBe("partner");
        if (updated.relationship !== "partner")
          throw new Error("Expected Partner Project");
        expect(updated.partnership.claimStatus).toBe("rejected");
      } finally {
        await db
          .update(claimsTable)
          .set(baselineClaim)
          .where(eq(claimsTable.id, baselineClaim.id));
      }
    });

    it.each([
      "editable",
      "submitted",
      "correction_requested",
      "approved",
    ] as const)("blocks %s with the Partnership named", async (status) => {
      useScenario(status);
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
      useScenario("claimless-partial");
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
      useScenario("terminal");
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

    it.each([
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ])(
      "allows Hosting %s with organization-wide or explicit assignment authority",
      async (role) => {
        actor = id(`assigned-${role}`);
        useSession(host);
        useScenario("terminal");
        expect(await complete()).toMatchObject({
          projectId,
          completed: true,
          completedByUserId: actor,
          completedAt: expect.any(Date),
        });
      },
    );

    it("denies assigned participants without the coordinator role", async () => {
      actor = id("assigned-participant");
      useSession(host);
      await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [record] = await db
        .select({ completedAt: projectsTable.completedAt })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(record?.completedAt).toBeNull();
    });

    it.each([
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ])("denies Hosting %s without assignment", async (role) => {
      actor = id(`unassigned-${role}`);
      useSession(host);
      await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("denies Partner-side and unauthenticated completion", async () => {
      useSession(partnerIds[0]!);
      await expect(complete()).rejects.toMatchObject({
        code: "NOT_FOUND",
        data: { reason: "PROJECT_NOT_FOUND" },
      });
      authMocks.getSession.mockResolvedValue(null);
      await expect(complete()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
  });
  describe("get", () => {
    const suffix = "canonical";
    const userId = `detail-user-${suffix}`;
    const hostId = `detail-host-${suffix}`;
    const partnerId = `detail-partner-${suffix}`;
    const unrelatedId = `detail-unrelated-${suffix}`;
    const projectId = `detail-project-${suffix}`;
    const partnershipId = `detail-partnership-${suffix}`;
    const assignedAt = new Date("2024-02-01T10:00:00.000Z");
    const updatedAt = new Date("2024-02-02T10:00:00.000Z");
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

    beforeEach(() => {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      useSession(hostId);
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

    it("returns NOT_FOUND for an inaccessible Project", async () => {
      useSession(unrelatedId);

      await expect(client.projects.get({ projectId })).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Project not found in scope.",
        data: { reason: "PROJECT_NOT_FOUND" },
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
    const suffix = "canonical";
    let userId = `list-user-${suffix}`;
    const hostId = `list-host-${suffix}`;
    const partnerId = `list-partner-${suffix}`;
    const secondPartnerId = `list-second-partner-${suffix}`;
    const unrelatedId = `list-unrelated-${suffix}`;
    const alphaId = `list-alpha-${suffix}`;
    const betaId = `list-beta-${suffix}`;
    const climateId = `list-climate-${suffix}`;
    const foreignId = `list-foreign-${suffix}`;
    const headers = new Headers();
    const client = createRouterClient(router, {
      context: async () => ({ headers }),
    });

    function useActiveOrganization(activeOrganizationId: string) {
      authMocks.getSession.mockResolvedValue({
        session: { id: randomUUID(), userId, activeOrganizationId },
        user: { id: userId, name: "List User", email: `${userId}@example.com` },
      });
    }

    beforeEach(async () => {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      useActiveOrganization(hostId);
      userId = `list-user-${suffix}`;
      useActiveOrganization(hostId);
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
        dateFrom: new Date("2024-06-03T00:00:00.000Z"),
        dateTo: new Date("2024-06-03T00:00:00.000Z"),
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
        dateFrom: new Date("2024-06-03T00:00:00.000Z"),
        dateTo: new Date("2024-06-03T00:00:00.000Z"),
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
          dateFrom: new Date("2024-07-01T00:00:00.000Z"),
          dateTo: new Date("2024-06-01T00:00:00.000Z"),
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
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.ProjectCoordinator,
      `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
    ])(
      "denies org-wide hosted overview to %s even with project.read",
      async (role) => {
        userId = `list-${role}-${suffix}`;
        useActiveOrganization(hostId);
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
    const suffix = "canonical";
    const hostingOrganizationId = `relationship-host-${suffix}`;
    const partnerOrganizationId = `relationship-partner-${suffix}`;
    const unrelatedOrganizationId = `relationship-unrelated-${suffix}`;
    const projectId = `relationship-project-${suffix}`;
    const archivedProjectId = `relationship-archived-${suffix}`;
    const partnershipId = `relationship-partnership-${suffix}`;

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

  describe("assigned coordinator Partner discovery", () => {
    const suffix = "canonical";
    const coord = `discovery-coord-${suffix}`;
    const stranger = `discovery-stranger-${suffix}`;
    const partner = `discovery-partner-${suffix}`;
    const assignedProject = `discovery-assigned-${suffix}`;
    const foreignProject = `discovery-foreign-${suffix}`;
    const assignedPartnership = `discovery-link-own-${suffix}`;
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const useCoordinator = (userId: string) => {
      authMocks.getSession.mockResolvedValue({
        session: {
          id: randomUUID(),
          userId,
          activeOrganizationId: partner,
        },
        user: {
          id: userId,
          name: "Discovery coordinator",
          email: `${userId}@example.com`,
        },
      });
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Deny every Organization-wide permission so only the assignment
      // scope can grant access.
      authMocks.hasPermission.mockResolvedValue({ success: false });
      useCoordinator(coord);
    });

    it("announces exactly the assigned Partnership scope", async () => {
      expect(await client.projects.scopes()).toEqual({
        hosted: false,
        partner: true,
        canCreate: true,
      });
    });

    it("lists exactly the assigned Project", async () => {
      const result = await client.projects.listPartner({ pageSize: 25 });
      expect(result.scope).toBe("partner");
      expect(result.rows.map((row) => row.id)).toEqual([assignedProject]);
      expect(result.metrics.whole.projectCount).toBe(1);
    });

    it("opens the assigned Project detail", async () => {
      await expect(
        client.projects.get({ projectId: assignedProject }),
      ).resolves.toMatchObject({
        relationship: "partner",
        partnership: { id: assignedPartnership },
      });
    });

    it("denies the unassigned Project in the same Organization", async () => {
      await expect(
        client.projects.get({ projectId: foreignProject }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("hides every scope from coordinators without assignment", async () => {
      useCoordinator(stranger);
      expect(await client.projects.scopes()).toEqual({
        hosted: false,
        partner: false,
        canCreate: true,
      });
      await expect(
        client.projects.listPartner({ pageSize: 25 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        client.projects.get({ projectId: assignedProject }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
