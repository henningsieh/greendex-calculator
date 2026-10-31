// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  afterEach,
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

// Stable identities registered in SEED_SCENARIOS.costTrackerPartnerships.
const suffix = "canonical";
const userId = `partnership-user-${suffix}`;
const hostId = `partnership-host-${suffix}`;
const foreignHostId = `partnership-foreign-host-${suffix}`;
const assignedOrganizationId = `partnership-assigned-org-${suffix}`;
const candidateOrganizationId = `partnership-candidate-org-${suffix}`;
const raceOrganizationId = `partnership-race-org-${suffix}`;
const projectId = `partnership-project-${suffix}`;
const foreignProjectId = `partnership-foreign-project-${suffix}`;
const assignedPartnershipId = `partnership-assigned-${suffix}`;
const removablePartnershipId = `partnership-removable-${suffix}`;
let removableBaseline: typeof projectPartnerOrganizationsTable.$inferSelect;
const createdPartnershipIds: string[] = [];
const headers = new Headers();
const client = createRouterClient(router, { context: async () => ({ headers }) });

async function waitForAuthoritativeProjectLock() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await db.execute(sql<{ waiting: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%select "id", "name" from "project"%'
          AND query ILIKE '%for update%'
      ) AS "waiting"
    `);
    if (result.rows[0]?.waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("The authoritative Project lock was not requested.");
}

function useActiveOrganization(activeOrganizationId: string) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: {
      id: userId,
      name: "Partnership User",
      email: `${userId}@example.com`,
    },
  });
}

beforeAll(async () => {
  const row = await db.query.projectPartnerOrganizationsTable.findFirst({
    where: eq(projectPartnerOrganizationsTable.id, removablePartnershipId),
  });
  if (!row)
    throw new Error(
      "Canonical seed required: run the isolated seeded lifecycle.",
    );
  removableBaseline = row;
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  useActiveOrganization(hostId);
});

afterEach(async () => {
  if (createdPartnershipIds.length > 0) {
    await db
      .delete(projectPartnerOrganizationsTable)
      .where(inArray(projectPartnerOrganizationsTable.id, createdPartnershipIds));
    createdPartnershipIds.length = 0;
  }
  // Removal is the behavior under test; restore the exact canonical baseline
  // (including its metadata) rather than recreating ordinary setup per case.
  if (
    removableBaseline &&
    !(await db.query.projectPartnerOrganizationsTable.findFirst({
      where: eq(projectPartnerOrganizationsTable.id, removablePartnershipId),
    }))
  )
    await db.insert(projectPartnerOrganizationsTable).values(removableBaseline);
});

describe("Project Partnership procedures", () => {
  it("lists only Partnerships on Projects hosted by the active Organization", async () => {
    const partnerships = await client.projectPartnerships.list();

    expect(partnerships.map((partnership) => partnership.id)).toEqual([
      assignedPartnershipId,
      removablePartnershipId,
    ]);
    expect(partnerships[0]).toMatchObject({
      projectId,
      projectName: "Managed Project",
      organizationId: assignedOrganizationId,
      organizationName: "Assigned Organization",
    });
  });

  it("assigns an existing Organization once to a hosted Project", async () => {
    const partnership = await client.projectPartnerships.assign({
      projectId,
      organizationId: candidateOrganizationId,
    });
    createdPartnershipIds.push(partnership.id);

    expect(partnership).toMatchObject({
      projectId,
      organizationId: candidateOrganizationId,
      organizationName: "Candidate Organization",
    });
    await expect(
      client.projectPartnerships.assign({
        projectId,
        organizationId: candidateOrganizationId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects self-Partnership and foreign hosted Projects", async () => {
    await expect(
      client.projectPartnerships.assign({ projectId, organizationId: hostId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projectPartnerships.assign({
        projectId: foreignProjectId,
        organizationId: candidateOrganizationId,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PROJECT_NOT_FOUND" },
    });
  });

  it("removes an unreferenced Partnership", async () => {
    await expect(
      client.projectPartnerships.remove({ id: removablePartnershipId }),
    ).resolves.toEqual({ id: removablePartnershipId, removed: true });
  });

  it("translates the represented-Organization removal block safely", async () => {
    await expect(
      client.projectPartnerships.remove({ id: assignedPartnershipId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not assign after Hosting ownership changes between relationship resolution and mutation", async () => {
    let releaseOwnershipChange: (() => void) | undefined;
    let ownershipLockReady: (() => void) | undefined;
    const ownershipLock = new Promise<void>((resolve) => {
      ownershipLockReady = resolve;
    });
    const ownershipChange = db.transaction(async (transaction) => {
      await transaction.execute(sql`LOCK TABLE "project" IN EXCLUSIVE MODE`);
      ownershipLockReady?.();
      await new Promise<void>((resolve) => {
        releaseOwnershipChange = resolve;
      });
      // Corruption under test: concurrent ownership change must be rejected by
      // the authoritative Project lock. The finally block restores the owner.
      await transaction
        .update(projectsTable)
        .set({ organizationId: foreignHostId })
        .where(eq(projectsTable.id, projectId));
    });
    let assignment: Promise<{ error?: unknown }> | undefined;

    try {
      await ownershipLock;
      assignment = client.projectPartnerships
        .assign({
          projectId,
          organizationId: raceOrganizationId,
        })
        .then(
          () => ({}),
          (error: unknown) => ({ error }),
        );
      // Red if assignment uses the earlier relationship read instead of a
      // project-row lock scoped to the active Organization before insertion.
      await waitForAuthoritativeProjectLock();

      releaseOwnershipChange?.();
      await ownershipChange;

      await expect(assignment).resolves.toMatchObject({
        error: {
          code: "NOT_FOUND",
          data: { reason: "PROJECT_NOT_FOUND" },
        },
      });
    } finally {
      releaseOwnershipChange?.();
      await ownershipChange.catch(() => undefined);
      await assignment?.catch(() => undefined);
      await db
        .delete(projectPartnerOrganizationsTable)
        .where(
          and(
            eq(projectPartnerOrganizationsTable.projectId, projectId),
            eq(
              projectPartnerOrganizationsTable.organizationId,
              raceOrganizationId,
            ),
          ),
        );
      await db
        .update(projectsTable)
        .set({ organizationId: hostId })
        .where(eq(projectsTable.id, projectId));
    }
  });

  it("requires authoritative mutation permission", async () => {
    authMocks.hasPermission.mockResolvedValue({ success: false });

    await expect(
      client.projectPartnerships.assign({
        projectId,
        organizationId: candidateOrganizationId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  describe("assigned coordinator partnership visibility", () => {
    // Read-only assigned/unassigned coordinator scenarios are canonical too.
    const suffix = "canonical";
    const coord = `partnership-visibility-coord-${suffix}`;
    const stranger = `partnership-visibility-stranger-${suffix}`;
    const partner = `partnership-visibility-partner-${suffix}`;
    const ownPartnership = `partnership-visibility-link-own-${suffix}`;
    const useViewer = (viewerId: string) => {
      authMocks.getSession.mockResolvedValue({
        session: {
          id: randomUUID(),
          userId: viewerId,
          activeOrganizationId: partner,
        },
        user: {
          id: viewerId,
          name: "Visibility viewer",
          email: `${viewerId}@example.com`,
        },
      });
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Deny Organization-wide reads so only the assignment scope grants.
      authMocks.hasPermission.mockResolvedValue({ success: false });
      useViewer(coord);
    });

    it("lists exactly the assigned Partnership", async () => {
      const rows = await client.projectPartnerships.list();
      expect(rows.map((row) => row.id)).toEqual([ownPartnership]);
    });

    it("denies coordinators without assignment", async () => {
      useViewer(stranger);
      await expect(client.projectPartnerships.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });
});
