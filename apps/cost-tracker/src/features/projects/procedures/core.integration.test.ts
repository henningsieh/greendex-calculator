// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  claimsTable,
  hostProjectAssignmentsTable as hostAssignments,
  principalQuotaCounters as counters,
  member,
  organization,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient, ORPCError } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));

const quotaMocks = vi.hoisted(() => ({
  enforceListingLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/quotas/procedures/counters", () => ({
  enforceListingLimit: quotaMocks.enforceListingLimit,
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import { resolveRelationship } from "@/features/projects/procedures/core";
import { enforceListingLimit } from "@/features/quotas/procedures/counters";
import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerProjects.
describe("projects procedures", () => {
  it("orders and traverses isolated mixed settlement Projects globally", async () => {
    const actor = randomUUID();
    const host = randomUUID();
    const partner = randomUUID();
    const now = new Date();
    const sessionId = randomUUID();
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const useSession = (activeOrganizationId: string) =>
      authMocks.getSession.mockResolvedValue({
        session: { id: sessionId, userId: actor, activeOrganizationId },
        user: {
          id: actor,
          name: "Isolated sort user",
          email: `${actor}@example.com`,
        },
      });
    const rows = Array.from({ length: 33 }, (_, index) => ({
      id: randomUUID(),
      name: `${"Long project name ".repeat(100)}Sort fixture ${Math.floor(index / 4) % 2}`,
      startDate: new Date(Date.UTC(2026, 0, 1 + (index % 4))),
      endDate: new Date(Date.UTC(2026, 1, 1 + (Math.floor(index / 8) % 2))),
      location: "Berlin",
      country: "DE" as const,
      organizationId: host,
      costTrackerArchived: index >= 24,
      rank: index < 12 ? 0 : index < 24 ? 1 : 2,
    }));
    try {
      vi.clearAllMocks();
      authMocks.hasPermission.mockResolvedValue({ success: true });
      await db.insert(user).values({
        id: actor,
        name: "Isolated sort user",
        email: `${actor}@example.com`,
        emailVerified: true,
      });
      await db.insert(organization).values(
        [host, partner].map((id) => ({
          id,
          name: id,
          slug: id,
          country: "DE" as const,
          createdAt: now,
        })),
      );
      await db.insert(member).values(
        [host, partner].map((organizationId) => ({
          id: randomUUID(),
          userId: actor,
          organizationId,
          role: ORGANIZATION_ROLES.OrganizationOwner,
          createdAt: now,
        })),
      );
      await db
        .insert(projectsTable)
        .values(rows.map(({ rank: _rank, ...row }) => row));
      const links = rows.map((row) => ({
        id: randomUUID(),
        projectId: row.id,
        organizationId: partner,
        rank: row.rank,
      }));
      await db
        .insert(partnerships)
        .values(links.map(({ rank: _rank, ...link }) => link));
      await db.insert(claimsTable).values(
        links
          .filter((link) => link.rank === 1)
          .map((link) => ({
            id: randomUUID(),
            partnershipId: link.id,
            status: "paid" as const,
          })),
      );
      const order = [...rows]
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            a.startDate.getTime() - b.startDate.getTime() ||
            a.id.localeCompare(b.id),
        )
        .map((row) => row.id);
      const customOrder = [...rows]
        .sort(
          (a, b) =>
            b.name.localeCompare(a.name) ||
            b.startDate.getTime() - a.startDate.getTime() ||
            a.id.localeCompare(b.id),
        )
        .map((row) => row.id);
      const customSort = [
        { field: "name" as const, direction: "desc" as const },
        { field: "startDate" as const, direction: "desc" as const },
      ];
      // The first 24 rows include pairs tied through three keys. The fourth
      // key must decide their order rather than the final ID tie-break.
      const deepSort = [
        { field: "startDate" as const, direction: "desc" as const },
        { field: "endDate" as const, direction: "desc" as const },
        { field: "name" as const, direction: "asc" as const },
        { field: "settlement" as const, direction: "desc" as const },
      ];
      for (const scope of ["hosted", "partner"] as const) {
        useSession(scope === "hosted" ? host : partner);
        for (const sort of [
          undefined,
          customSort,
          ...[2, 3, 4].map((depth) => deepSort.slice(0, depth)),
        ]) {
          const expected = !sort
            ? order
            : sort === customSort
              ? customOrder
              : [...rows]
                  .sort((a, b) => {
                    for (const { field, direction } of sort) {
                      const difference =
                        field === "startDate"
                          ? a.startDate.getTime() - b.startDate.getTime()
                          : field === "endDate"
                            ? a.endDate.getTime() - b.endDate.getTime()
                            : field === "name"
                              ? a.name.localeCompare(b.name)
                              : a.rank - b.rank;
                      if (difference)
                        return direction === "asc" ? difference : -difference;
                    }
                    return a.id.localeCompare(b.id);
                  })
                  .map((row) => row.id);
          const input = { pageSize: 25 as const, archive: "all" as const, sort };
          const list = (cursor?: string) =>
            scope === "hosted"
              ? client.projects.listHosted({ ...input, cursor })
              : client.projects.listPartner({ ...input, cursor });
          const first = await list();
          expect(first.nextCursor!.length).toBeLessThanOrEqual(2048);
          const second = await list(first.nextCursor);
          expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(
            expected,
          );
          expect(first.metrics.filtered.projectCount).toBe(33);
          expect(second.metrics).toEqual(first.metrics);
          expect(
            (await list(second.previousCursor)).rows.map((row) => row.id),
          ).toEqual(first.rows.map((row) => row.id));
          expect(second.nextCursor).toBeUndefined();
          await expect(
            list(first.nextCursor && `${first.nextCursor}x`),
          ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        }
      }
      useSession(host);
      const ready = await client.projects.listHosted({
        pageSize: 25,
        archive: "all",
        settlement: "ready",
      });
      expect(ready.metrics.filtered.projectCount).toBe(12);
      expect(ready.rows.map((row) => row.id).sort()).toEqual(
        rows
          .filter((row) => row.rank === 1)
          .map((row) => row.id)
          .sort(),
      );
      const impossible = await client.projects.listHosted({
        pageSize: 25,
        archive: "archived",
        settlement: "ready",
      });
      expect(impossible.metrics.filtered.projectCount).toBe(0);
      const first = await client.projects.listHosted({
        pageSize: 25,
        archive: "all",
      });
      await expect(
        client.projects.listHosted({
          pageSize: 25,
          archive: "all",
          sort: customSort,
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const nameInput = {
        pageSize: 25 as const,
        archive: "all" as const,
        sort: [{ field: "name" as const, direction: "asc" as const }],
      };
      const hostedNamePage = await client.projects.listHosted(nameInput);
      useSession(partner);
      const partnerNamePage = await client.projects.listPartner(nameInput);
      const removedAnchor = hostedNamePage.rows.at(-1)!.id;
      expect(partnerNamePage.rows.at(-1)!.id).toBe(removedAnchor);
      await db.delete(projectsTable).where(eq(projectsTable.id, removedAnchor));
      await expect(
        client.projects.listPartner({
          ...nameInput,
          cursor: partnerNamePage.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      useSession(host);
      await expect(
        client.projects.listHosted({
          ...nameInput,
          cursor: hostedNamePage.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    } finally {
      await db.delete(organization).where(eq(organization.id, host));
      await db.delete(organization).where(eq(organization.id, partner));
      await db.delete(user).where(eq(user.id, actor));
    }
  });
  describe("derived readiness and completion", () => {
    let actor = SEED_IDS.user.readinessActor;
    const host = SEED_IDS.organization.readinessHost;
    const partnerIds = [
      SEED_IDS.organization.projectsOrg1,
      SEED_IDS.organization.projectsOrg2,
      SEED_IDS.organization.projectsOrg3,
    ];
    const readinessSeedProjectIds = [
      SEED_IDS.project.projectsProject0, // empty
      SEED_IDS.project.projectsProject2, // mixed
      SEED_IDS.project.projectsProject4, // claimless-partial
      SEED_IDS.project.projectsProject6, // terminal
      SEED_IDS.project.projectsProject8, // editable
      SEED_IDS.project.projectsProject10, // submitted
      SEED_IDS.project.projectsProject12, // correction_requested
      SEED_IDS.project.projectsProject14, // approved
    ] as const;
    let readinessProjectIds: string[] = [];
    const readinessScenarioNames = [
      "empty",
      "mixed",
      "claimless-partial",
      "terminal",
      "in_preparation",
      "submitted",
      "correction_requested",
      "approved",
    ] as const;
    let projectId: string;
    function useScenario(name: (typeof readinessScenarioNames)[number]) {
      projectId = readinessProjectIds[readinessScenarioNames.indexOf(name)]!;
    }
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const complete = () => client.projects.archive({ projectId });
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
      actor = SEED_IDS.user.readinessActor;
      useSession(host);
      readinessProjectIds = [];
      for (const seedId of readinessSeedProjectIds) {
        const [seed] = await db
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, seedId));
        if (!seed) throw new Error("Readiness Project seed required");
        const id = randomUUID();
        await db.insert(projectsTable).values({
          ...seed,
          id,
          costTrackerArchived: false,
          completedAt: null,
          completedByUserId: null,
        });
        readinessProjectIds.push(id);
        const assignments = await db
          .select({ userId: hostAssignments.userId })
          .from(hostAssignments)
          .where(eq(hostAssignments.projectId, seedId));
        if (assignments.length)
          await db
            .insert(hostAssignments)
            .values(assignments.map(({ userId }) => ({ projectId: id, userId })));
        const seedPartnerships = await db
          .select()
          .from(partnerships)
          .where(eq(partnerships.projectId, seedId));
        for (const partnership of seedPartnerships) {
          const newId = randomUUID();
          await db
            .insert(partnerships)
            .values({ ...partnership, id: newId, projectId: id });
          const [claim] = await db
            .select()
            .from(claimsTable)
            .where(eq(claimsTable.partnershipId, partnership.id));
          if (claim)
            await db
              .insert(claimsTable)
              .values({ ...claim, id: randomUUID(), partnershipId: newId });
        }
      }
      useScenario("empty");
    });

    it("intersects archive and settlement filters over missing, mixed and settled Claims", async () => {
      useScenario("terminal");
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: true })
        .where(eq(projectsTable.id, projectId));
      const archivedId = projectId;
      const emptyId = readinessProjectIds[0]!;
      await db.delete(partnerships).where(eq(partnerships.projectId, emptyId));
      const mixedId = readinessProjectIds[1]!;
      const missingId = readinessProjectIds[2]!;
      const open = await client.projects.listHosted({
        pageSize: 100,
        archive: "all",
        settlement: "open",
      });
      const ready = await client.projects.listHosted({
        pageSize: 100,
        archive: "all",
        settlement: "ready",
      });
      const archived = await client.projects.listHosted({
        pageSize: 100,
        archive: "archived",
      });
      const contradictory = await client.projects.listHosted({
        pageSize: 100,
        archive: "archived",
        settlement: "ready",
      });
      expect(open.rows.map((row) => row.id)).toEqual(
        expect.arrayContaining([mixedId, missingId]),
      );
      expect(ready.rows.map((row) => row.id)).toContain(emptyId);
      expect(ready.rows.map((row) => row.id)).not.toContain(archivedId);
      expect(archived.rows.map((row) => row.id)).toContain(archivedId);
      expect(contradictory.rows).toEqual([]);
      expect(contradictory.metrics.filtered.projectCount).toBe(0);
    });
    afterEach(async () => {
      for (const id of readinessProjectIds)
        await db.delete(projectsTable).where(eq(projectsTable.id, id));
    });

    it("returns the locked archived state when a Hosted detail waits for an archive", async () => {
      actor = SEED_IDS.user.projectsUser4;
      useSession(host);
      let release!: () => void;
      let locked!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const held = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const blocker = db.transaction(async (tx) => {
        await tx
          .update(projectsTable)
          .set({ costTrackerArchived: true })
          .where(eq(projectsTable.id, projectId));
        locked();
        await gate;
      });
      await held;
      const detail = client.projects.get({ projectId });
      try {
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const result = await db.execute(
            sql`select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%for share%' and query ilike '%project%') as waiting`,
          );
          if (result.rows[0].waiting) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      } finally {
        release();
        await blocker;
      }
      expect(await detail).toMatchObject({
        relationship: "hosted",
        archived: true,
        canReopen: true,
      });
      await expect(
        client.projects.reopen({ projectId, reason: "Correct state" }),
      ).resolves.toEqual({ projectId, archived: false });
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

      const [baselineClaim] = await db
        .select({ id: claimsTable.id, status: claimsTable.status })
        .from(claimsTable)
        .innerJoin(partnerships, eq(partnerships.id, claimsTable.partnershipId))
        .where(
          and(
            eq(partnerships.projectId, projectId),
            eq(partnerships.organizationId, partnerIds[0]!),
          ),
        );
      if (!baselineClaim) throw new Error("Seed mixed-status Claim required.");
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
          .set({ status: baselineClaim.status })
          .where(eq(claimsTable.id, baselineClaim.id));
      }
    });

    it.each([
      "in_preparation",
      "submitted",
      "correction_requested",
      "approved",
    ] as const)("blocks %s with the Partnership named", async (status) => {
      useScenario(status);
      await expect(complete()).rejects.toMatchObject({
        code: "CONFLICT",
        data: {
          reason: "PROJECT_ARCHIVE_BLOCKED",
        },
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
        code: "CONFLICT",
        data: { reason: "PROJECT_ARCHIVE_BLOCKED" },
      });
      await expect(complete()).rejects.toMatchObject({
        code: "CONFLICT",
        data: { reason: "PROJECT_ARCHIVE_BLOCKED" },
      });
      await expect(complete()).rejects.toMatchObject({
        code: "CONFLICT",
        data: { reason: "PROJECT_ARCHIVE_BLOCKED" },
      });
    });

    it("completes when every Partnership is paid or rejected, independently of another Project", async () => {
      useScenario("terminal");
      const result = await complete();
      expect(result).toMatchObject({
        projectId,
        archived: true,
      });
      const [record] = await db
        .select({
          archived: projectsTable.costTrackerArchived,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(record).toEqual({ archived: true });
      const detail = await client.projects.get({ projectId });
      const [stored] = await db
        .select({
          endDate: projectsTable.endDate,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(detail).toMatchObject({ archived: true });
      // `daysLeft` is whole days from the procedure's own clock read. Compare
      // against a stable interval: an exact recomputation can differ by one
      // when the two Date.now() calls straddle a day boundary.
      const expectedDaysLeft = Math.ceil(
        (stored!.endDate.getTime() - Date.now()) / 86_400_000,
      );
      expect(detail.daysLeft).toBeGreaterThanOrEqual(expectedDaysLeft - 1);
      expect(detail.daysLeft).toBeLessThanOrEqual(expectedDaysLeft + 1);
      useSession(partnerIds[0]!);
      expect(await client.projects.get({ projectId })).toMatchObject({
        relationship: "partner",
        archived: true,
      });
      useSession(host);
      await expect(complete()).rejects.toMatchObject({ code: "CONFLICT" });
      const [unchanged] = await db
        .select({
          archived: projectsTable.costTrackerArchived,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(unchanged).toEqual(record);
    });

    it.each([
      SEED_IDS.user.projectsUser2,
      SEED_IDS.user.projectsUser4,
      SEED_IDS.user.projectsUser6,
    ] as const)(
      "allows Hosting %s with organization-wide or explicit assignment authority",
      async (actorId) => {
        actor = actorId;
        useSession(host);
        useScenario("terminal");
        expect(await complete()).toMatchObject({
          projectId,
          archived: true,
        });
      },
    );

    it("denies assigned participants without the coordinator role", async () => {
      actor = SEED_IDS.user.projectsUser8;
      useSession(host);
      await expect(complete()).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [record] = await db
        .select({ archived: projectsTable.costTrackerArchived })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      expect(record?.archived).toBe(false);
    });

    it.each([
      SEED_IDS.user.projectsUser9,
      SEED_IDS.user.projectsUser9,
      SEED_IDS.user.projectsUser7,
    ] as const)("denies Hosting %s without assignment", async (actorId) => {
      actor = actorId;
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
    const userId = SEED_IDS.user.projectDetailUserId;
    const hostId = SEED_IDS.organization.projectDetailHostId;
    const partnerId = SEED_IDS.organization.projectDetailPartnerId;
    const unrelatedId = SEED_IDS.organization.projectDetailUnrelatedId;
    const projectId = SEED_IDS.project.projectDetailProjectId;
    const partnershipId = SEED_IDS.partnership.projectDetailPartnershipId;
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
      expect(detail).not.toHaveProperty("costSubmissionWindowOpen");
      expect(detail).not.toHaveProperty("hostAssignments");
    });

    it("keeps an expired Project's daysLeft negative inside the final 24 hours", async () => {
      // Math.ceil collapses (-1h / 24h) to -0, which reads as "0 days left"
      // instead of "Ended". Restore the seeded dates afterwards.
      const [original] = await db
        .select({
          startDate: projectsTable.startDate,
          endDate: projectsTable.endDate,
        })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      const endedAt = new Date(Date.now() - 60 * 60 * 1000);
      await db
        .update(projectsTable)
        .set({
          startDate: new Date(endedAt.getTime() - 86_400_000),
          endDate: endedAt,
        })
        .where(eq(projectsTable.id, projectId));
      try {
        const detail = await client.projects.get({ projectId });
        expect(detail.daysLeft).toBe(-1);
        expect(Object.is(detail.daysLeft, -0)).toBe(false);
      } finally {
        await db
          .update(projectsTable)
          .set(original!)
          .where(eq(projectsTable.id, projectId));
      }
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
    let userId = SEED_IDS.user.projectListUserId;
    const hostId = SEED_IDS.organization.projectListHostId;
    const partnerId = SEED_IDS.organization.projectListPartnerId;
    const secondPartnerId = SEED_IDS.organization.projectListSecondPartnerId;
    const unrelatedId = SEED_IDS.organization.projectListUnrelatedId;
    const alphaId = SEED_IDS.project.projectListAlphaId;
    const betaId = SEED_IDS.project.projectListBetaId;
    const foreignId = SEED_IDS.project.projectListForeignId;
    const calculatorArchivedId = SEED_IDS.project.projectListArchivedId;
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
      userId = SEED_IDS.user.projectListUserId;
      useActiveOrganization(hostId);
    });
    it("returns a bounded Hosted page with whole-scope metrics", async () => {
      expect(vi.isMockFunction(enforceListingLimit)).toBe(true);
      const quotaRows = () =>
        db
          .select()
          .from(counters)
          .where(
            and(
              eq(counters.kind, "listing_calls"),
              eq(counters.organizationId, hostId),
            ),
          );
      const quotaBefore = await quotaRows();
      const result = await client.projects.listHosted({ pageSize: 25 });

      expect(result.scope).toBe("hosted");
      expect(result.rows).toHaveLength(25);
      expect(result.nextCursor).toEqual(expect.any(String));
      expect(result.metrics.whole).toEqual({
        projectCount: 30,
        partnerOrganizationCount: 2,
      });
      expect(result.metrics.filtered).toEqual(result.metrics.whole);
      const settlementPriority = { open: 0, ready: 1, archived: 2 };
      for (const [index, row] of result.rows.entries()) {
        const previous = result.rows[index - 1];
        if (!previous) continue;
        const stateDifference =
          settlementPriority[row.settlement] -
          settlementPriority[previous.settlement];
        expect(stateDifference).toBeGreaterThanOrEqual(0);
        if (stateDifference === 0)
          expect(row.startDate.getTime()).toBeGreaterThanOrEqual(
            previous.startDate.getTime(),
          );
      }
      expect(result.rows[0]).not.toHaveProperty("organizationId");

      const largerPage = await client.projects.listHosted({ pageSize: 50 });
      expect(largerPage.metrics).toEqual(result.metrics);
      expect(quotaMocks.enforceListingLimit).toHaveBeenCalledWith(
        { userId: userId, organizationId: hostId },
        expect.any(Object),
      );
      expect(await quotaRows()).toEqual(quotaBefore);
    });

    it.each([
      [[{ field: "startDate" as const, direction: "asc" as const }]],
      [[{ field: "startDate" as const, direction: "desc" as const }]],
      [[{ field: "endDate" as const, direction: "asc" as const }]],
      [[{ field: "endDate" as const, direction: "desc" as const }]],
      [
        [
          { field: "name" as const, direction: "desc" as const },
          { field: "startDate" as const, direction: "asc" as const },
        ],
      ],
      [
        [
          { field: "settlement" as const, direction: "asc" as const },
          { field: "startDate" as const, direction: "desc" as const },
        ],
      ],
    ])(
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
          expect(second.rows).toHaveLength(scope === "hosted" ? 5 : 4);
          expect(second.previousCursor).toEqual(expect.any(String));
          expect(second.nextCursor).toBeUndefined();
          expect(second.metrics).toEqual(first.metrics);
          expect(
            new Set([...first.rows, ...second.rows].map((project) => project.id))
              .size,
          ).toBe(scope === "hosted" ? 30 : 29);

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
      const staleCursor = Buffer.from(JSON.stringify({ version: 2 })).toString(
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

      const next = await client.projects.listHosted({
        pageSize: 25,
        cursor: first.nextCursor,
      });
      expect(next.previousCursor).toEqual(expect.any(String));
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
          sort: [{ field: "endDate", direction: "desc" }],
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

    it("applies normalized name, overlap-date, and match-any Partner filters", async () => {
      const literalWildcards = await client.projects.listHosted({
        pageSize: 25,
        search: "%__",
      });
      expect(literalWildcards.rows).toEqual([]);

      const result = await client.projects.listHosted({
        pageSize: 25,
        search: "  alpha ",
        dateFrom: new Date("2024-06-03T00:00:00.000Z"),
        dateTo: new Date("2024-06-03T00:00:00.000Z"),
        partnerOrganizationIds: [secondPartnerId, unrelatedId],
      });

      expect(result.rows.map((project) => project.id)).toEqual([alphaId]);
      expect(result.metrics.filtered).toEqual({
        projectCount: 1,
        partnerOrganizationCount: 2,
      });
      expect(result.metrics.whole.projectCount).toBe(30);
      expect(result.partnerOptions.map((partner) => partner.id)).toEqual([
        partnerId,
        secondPartnerId,
      ]);

      const largerPage = await client.projects.listHosted({
        pageSize: 50,
        search: "  alpha ",
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
      });
      expect(result).not.toHaveProperty("partnerOptions");
      for (const row of result.rows) {
        expect(row).not.toHaveProperty("organizationId");
        expect(row).not.toHaveProperty("partnerOrganizations");
        expect(row).not.toHaveProperty("hostAssignments");
        expect(row).not.toHaveProperty("amount");
      }
    });

    it("returns the same empty shape for invisible projects as for gibberish (no search oracle)", async () => {
      // #377: the response must not reveal whether a searched name exists
      // outside the caller's scope. "Foreign Partner Project" belongs to
      // another Hosting Organization, with list-partner as its only Partner
      // Organization. A Calculator-archived Project remains visible here.
      const gibberish = "zzz-no-such-project-zzz";
      useActiveOrganization(hostId);
      const hostedForeign = await client.projects.listHosted({
        pageSize: 25,
        search: "Foreign Partner Project",
      });
      const hostedArchived = await client.projects.listHosted({
        pageSize: 25,
        search: "Archived Project",
      });
      const hostedGibberish = await client.projects.listHosted({
        pageSize: 25,
        search: gibberish,
      });
      expect(hostedForeign.rows).toEqual([]);
      expect(hostedForeign).toEqual(hostedGibberish);
      expect(hostedArchived.rows.map((project) => project.id)).toEqual([
        calculatorArchivedId,
      ]);

      // Positive control: the Partner Organization that may see the foreign
      // Project finds it, so the empty shape above is scope enforcement,
      // not a broken search.
      useActiveOrganization(partnerId);
      const partnerForeign = await client.projects.listPartner({
        pageSize: 25,
        search: "Foreign Partner Project",
      });
      expect(partnerForeign.rows.map((row) => row.id)).toEqual([foreignId]);
      const partnerArchived = await client.projects.listPartner({
        pageSize: 25,
        search: "Archived Project",
      });
      const partnerGibberish = await client.projects.listPartner({
        pageSize: 25,
        search: gibberish,
      });
      expect(partnerArchived.rows).toEqual([]);
      expect(partnerArchived).toEqual(partnerGibberish);

      // partnerOptions stay need-to-know: Partner Organizations are listed (the
      // Hosting Organization manages those partnerships), unrelated
      // Organizations never are.
      useActiveOrganization(hostId);
      const options = await client.projects.listHosted({ pageSize: 25 });
      const optionIds = options.partnerOptions.map((option) => option.id);
      expect(optionIds).toContain(partnerId);
      expect(optionIds).not.toContain(unrelatedId);
    });

    it.each([
      SEED_IDS.user.projectsUser12,
      SEED_IDS.user.projectsUser12,
      SEED_IDS.user.projectsUser13,
      SEED_IDS.user.projectsUser14,
    ] as const)(
      "denies org-wide hosted overview to %s even with project.read",
      async (userIdValue) => {
        userId = userIdValue;
        useActiveOrganization(hostId);
        await expect(
          client.projects.listHosted({ pageSize: 25 }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await client.projects.scopes()).toEqual({
          hosted: false,
          partner: false,
        });
      },
    );

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
    const hostingOrganizationId =
      SEED_IDS.organization.projectRelationshipHostingOrganizationId;
    const partnerOrganizationId =
      SEED_IDS.organization.projectRelationshipPartnerOrganizationId;
    const unrelatedOrganizationId =
      SEED_IDS.organization.projectRelationshipUnrelatedOrganizationId;
    const projectId = SEED_IDS.project.projectRelationshipProjectId;
    const archivedProjectId =
      SEED_IDS.project.projectRelationshipArchivedProjectId;
    const partnershipId = SEED_IDS.partnership.projectRelationshipPartnershipId;

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
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: true })
        .where(eq(projectsTable.id, archivedProjectId));
      try {
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
      } finally {
        await db
          .update(projectsTable)
          .set({ costTrackerArchived: false })
          .where(eq(projectsTable.id, archivedProjectId));
      }
    });
  });

  describe("assigned coordinator Partner discovery", () => {
    const coord = SEED_IDS.user.projectDiscoveryCoord;
    const stranger = SEED_IDS.user.projectDiscoveryStranger;
    const partner = SEED_IDS.organization.projectDiscoveryPartner;
    const assignedProject = SEED_IDS.project.projectDiscoveryAssignedProject;
    const foreignProject = SEED_IDS.project.projectDiscoveryForeignProject;
    const assignedPartnership =
      SEED_IDS.partnership.projectDiscoveryAssignedPartnership;
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
      });
    });

    it("lists exactly the assigned Project", async () => {
      const result = await client.projects.listPartner({ pageSize: 25 });
      expect(result.scope).toBe("partner");
      expect(result.rows.map((row) => row.id)).toEqual([assignedProject]);
      expect(result.metrics.whole.projectCount).toBe(1);
    });

    it("exposes no search oracle to denied or assignment-limited principals", async () => {
      const gibberish = "zzz-no-such-project-zzz";
      const searchPartner = (search: string) =>
        client.projects.listPartner({ pageSize: 25, search });
      const observeDenial = async (request: Promise<unknown>) => {
        try {
          await request;
        } catch (error) {
          expect(error).toBeInstanceOf(ORPCError);
          if (!(error instanceof ORPCError)) throw error;
          // Compare the complete serialized error surface, excluding server-only stacks.
          return error.toJSON();
        }
        throw new Error("Expected search to be denied.");
      };

      // These two canonical principals share the same Partner Organization,
      // but only coord is assigned a Project Partnership. Neither has
      // Organization-wide read permission (see beforeEach).
      const assigned = await searchPartner(assignedProject);
      expect(assigned.rows.map((row) => row.id)).toEqual([assignedProject]);
      const noMatch = await searchPartner(gibberish);
      expect(noMatch.rows).toEqual([]);
      expect(noMatch.metrics).toEqual({
        whole: { projectCount: 1 },
        filtered: { projectCount: 0 },
      });
      expect(noMatch).not.toHaveProperty("partnerOptions");
      expect(await searchPartner(foreignProject)).toEqual(noMatch);

      // Positive control: the invisible search names a real, unassigned Project,
      // rather than comparing two nonexistent names.
      expect(
        await db.query.projectsTable.findFirst({
          where: eq(projectsTable.id, foreignProject),
          columns: { name: true },
        }),
      ).toEqual({ name: foreignProject });

      useCoordinator(stranger);
      const deniedNoMatch = await observeDenial(searchPartner(gibberish));
      expect(deniedNoMatch).toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "ACCESS_DENIED" },
      });
      for (const search of [assignedProject, foreignProject]) {
        expect(await observeDenial(searchPartner(search))).toEqual(deniedNoMatch);
      }

      // Hosted reads are denied for both restricted principals, regardless of
      // whether the input names a known Project or matches nothing. #408
      // consolidates the old middleware denial on the handler's
      // Organization-management-required reason; both render the same fallback.
      for (const principal of [coord, stranger]) {
        useCoordinator(principal);
        const searchHosted = (search: string) =>
          client.projects.listHosted({ pageSize: 25, search });
        const hostedNoMatch = await observeDenial(searchHosted(gibberish));
        expect(hostedNoMatch).toMatchObject({
          code: "FORBIDDEN",
          data: { reason: "ORGANIZATION_MANAGEMENT_REQUIRED" },
        });
        for (const search of [assignedProject, foreignProject]) {
          expect(await observeDenial(searchHosted(search))).toEqual(
            hostedNoMatch,
          );
        }
      }
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
      });
      await expect(
        client.projects.listPartner({ pageSize: 25 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        client.projects.get({ projectId: assignedProject }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("assigned coordinator Hosted discovery", () => {
    const host = SEED_IDS.organization.entitySearchHost;
    const coord = SEED_IDS.user.entitySearchCoordinator;
    const unassignedCoord = SEED_IDS.user.entitySearchUnassignedCoordinator;
    const participant = SEED_IDS.user.entitySearchParticipant;
    const owner = SEED_IDS.user.entitySearchActor;
    const assignedProject = SEED_IDS.project.entitySearchAssigned;
    const unassignedProject = SEED_IDS.project.entitySearchUnassigned;
    const client = createRouterClient(router, {
      context: async () => ({ headers: new Headers() }),
    });
    const usePrincipal = (userId: string) => {
      authMocks.getSession.mockResolvedValue({
        session: {
          id: randomUUID(),
          userId,
          activeOrganizationId: host,
        },
        user: {
          id: userId,
          name: "Hosted discovery",
          email: `${userId}@example.com`,
        },
      });
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Deny every Organization-wide permission so only the Host assignment
      // scope can grant access.
      authMocks.hasPermission.mockResolvedValue({ success: false });
      usePrincipal(coord);
    });

    it("exposes archive capability only on an authorized Hosted detail", async () => {
      await expect(
        client.projects.get({ projectId: assignedProject }),
      ).resolves.toMatchObject({ relationship: "hosted", canArchive: true });
      usePrincipal(unassignedCoord);
      await expect(
        client.projects.get({ projectId: assignedProject }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("lists exactly the assigned Hosted Project", async () => {
      const result = await client.projects.listHosted({ pageSize: 25 });

      expect(result.scope).toBe("hosted");
      expect(result.rows.map((row) => row.id)).toEqual([assignedProject]);
      expect(result.rows[0]).not.toHaveProperty("organizationId");
      expect(result.metrics.whole.projectCount).toBe(1);
      expect(result.metrics.filtered).toEqual(result.metrics.whole);
      expect(result.partnerOptions).toEqual([]);
    });

    it("composes search on top of the assignment filter without a search oracle", async () => {
      const gibberish = "zzz-no-such-project-zzz";
      const noMatch = await client.projects.listHosted({
        pageSize: 25,
        search: gibberish,
      });

      expect(noMatch.rows).toEqual([]);
      // Metrics still describe the assigned whole set, never hidden Projects.
      expect(noMatch.metrics.whole.projectCount).toBe(1);
      expect(noMatch.metrics.filtered.projectCount).toBe(0);
      // The unassigned Project name reads exactly like gibberish: assignment
      // to one Project never leaks access to another.
      expect(
        await client.projects.listHosted({
          pageSize: 25,
          search: "Picker Unassigned Project",
        }),
      ).toEqual(noMatch);
      // Positive control: the assigned Project stays searchable.
      const assigned = await client.projects.listHosted({
        pageSize: 25,
        search: "Picker Assigned Project",
      });
      expect(assigned.rows.map((row) => row.id)).toEqual([assignedProject]);
    });

    it("lists every assigned Hosted Project and nothing else", async () => {
      // Story 4: assignment to one Project must not hide another assigned one.
      const outsiderProject = randomUUID();
      // Fixtures are created inside `try` so a failure before the assertions
      // cannot leak rows into later tests.
      try {
        await db.insert(projectsTable).values({
          id: outsiderProject,
          name: "Hosted discovery outsider",
          startDate: new Date("2027-04-01"),
          endDate: new Date("2027-04-03"),
          location: "Berlin",
          country: "DE",
          organizationId: host,
        });
        await db
          .insert(hostAssignments)
          .values({ projectId: unassignedProject, userId: coord });
        const result = await client.projects.listHosted({ pageSize: 25 });
        // Both assigned Projects, and neither the unassigned sibling nor the
        // unrelated third Project of the same Organization.
        expect(result.rows.map((row) => row.id).sort()).toEqual(
          [assignedProject, unassignedProject].sort(),
        );
        expect(result.metrics.whole.projectCount).toBe(2);
      } finally {
        await db
          .delete(hostAssignments)
          .where(
            and(
              eq(hostAssignments.projectId, unassignedProject),
              eq(hostAssignments.userId, coord),
            ),
          );
        await db
          .delete(projectsTable)
          .where(eq(projectsTable.id, outsiderProject));
      }
    });

    it("announces the Hosted scope exactly for coordinators with assignment", async () => {
      expect(await client.projects.scopes()).toEqual({
        hosted: true,
        partner: false,
      });
    });

    it("denies coordinators without assignment with the management reason", async () => {
      // Pins the consolidated denial: dropping the unreadable-permission
      // middleware moves permission-less coordinators to the handler's
      // Organization-management-required reason. Both render the same fallback.
      usePrincipal(unassignedCoord);
      await expect(
        client.projects.listHosted({ pageSize: 25 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "ORGANIZATION_MANAGEMENT_REQUIRED" },
      });
      expect(await client.projects.scopes()).toEqual({
        hosted: false,
        partner: false,
      });
    });

    it("denies Participant-role members without taking the assignment path", async () => {
      usePrincipal(participant);
      await expect(
        client.projects.listHosted({ pageSize: 25 }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "ORGANIZATION_MANAGEMENT_REQUIRED" },
      });
    });

    it("keeps archived assigned Projects discoverable through archive filters", async () => {
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: true })
        .where(eq(projectsTable.id, assignedProject));
      try {
        expect(await client.projects.scopes()).toEqual({
          hosted: true,
          partner: false,
        });
        const active = await client.projects.listHosted({ pageSize: 25 });
        expect(active.rows).toEqual([]);
        expect(active.metrics.whole.projectCount).toBe(1);
        expect(active.metrics.filtered.projectCount).toBe(0);
        for (const archive of ["archived", "all"] as const) {
          const result = await client.projects.listHosted({
            pageSize: 25,
            archive,
          });
          expect(result.rows.map(({ id }) => id)).toEqual([assignedProject]);
          expect(result.metrics.whole.projectCount).toBe(1);
          expect(result.metrics.filtered.projectCount).toBe(1);
        }
      } finally {
        await db
          .update(projectsTable)
          .set({ costTrackerArchived: false })
          .where(eq(projectsTable.id, assignedProject));
      }
    });

    it("keeps Owner Hosted results identical with full read permission", async () => {
      authMocks.hasPermission.mockResolvedValue({ success: true });
      usePrincipal(owner);
      const result = await client.projects.listHosted({ pageSize: 25 });

      expect(result.scope).toBe("hosted");
      expect(result.rows.map((row) => row.id).sort()).toEqual(
        [assignedProject, unassignedProject].sort(),
      );
      expect(result.metrics.whole.projectCount).toBe(2);
      expect(result.metrics.filtered).toEqual(result.metrics.whole);
      expect(result.partnerOptions).toEqual([]);
    });
  });
});
