import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
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
const userId = `partnership-user-${suffix}`;
const hostId = `partnership-host-${suffix}`;
const foreignHostId = `partnership-foreign-host-${suffix}`;
const assignedOrganizationId = `partnership-assigned-org-${suffix}`;
const removableOrganizationId = `partnership-removable-org-${suffix}`;
const candidateOrganizationId = `partnership-candidate-org-${suffix}`;
const raceOrganizationId = `partnership-race-org-${suffix}`;
const projectId = `partnership-project-${suffix}`;
const foreignProjectId = `partnership-foreign-project-${suffix}`;
const assignedPartnershipId = `partnership-assigned-${suffix}`;
const removablePartnershipId = `partnership-removable-${suffix}`;
const participationId = `partnership-participation-${suffix}`;
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
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Partnership User",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: hostId, name: "Partnership Host", slug: hostId, createdAt: now },
    {
      id: foreignHostId,
      name: "Partnership Foreign Host",
      slug: foreignHostId,
      createdAt: now,
    },
    {
      id: assignedOrganizationId,
      name: "Assigned Organization",
      slug: assignedOrganizationId,
      createdAt: now,
    },
    {
      id: removableOrganizationId,
      name: "Removable Organization",
      slug: removableOrganizationId,
      createdAt: now,
    },
    {
      id: candidateOrganizationId,
      name: "Candidate Organization",
      slug: candidateOrganizationId,
      createdAt: now,
    },
    {
      id: raceOrganizationId,
      name: "Race Organization",
      slug: raceOrganizationId,
      createdAt: now,
    },
  ]);
  await db.insert(projectsTable).values([
    {
      id: projectId,
      name: "Managed Project",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-03T00:00:00.000Z"),
      location: "Tallinn",
      country: "EE",
      responsibleUserId: userId,
      organizationId: hostId,
    },
    {
      id: foreignProjectId,
      name: "Foreign Managed Project",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-03T00:00:00.000Z"),
      location: "Riga",
      country: "LV",
      responsibleUserId: userId,
      organizationId: foreignHostId,
    },
  ]);
  await db.insert(projectPartnerOrganizationsTable).values([
    {
      id: assignedPartnershipId,
      projectId,
      organizationId: assignedOrganizationId,
    },
    {
      id: removablePartnershipId,
      projectId,
      organizationId: removableOrganizationId,
    },
  ]);
  await db.insert(projectParticipantsTable).values({
    id: participationId,
    projectId,
    representedOrganizationId: assignedOrganizationId,
    displayName: "Assigned Participant",
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  useActiveOrganization(hostId);
});

afterAll(async () => {
  await db
    .delete(projectParticipantsTable)
    .where(inArray(projectParticipantsTable.id, [participationId]));
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(
      inArray(projectPartnerOrganizationsTable.id, [
        assignedPartnershipId,
        removablePartnershipId,
        ...createdPartnershipIds,
      ]),
    );
  await db
    .delete(projectsTable)
    .where(inArray(projectsTable.id, [projectId, foreignProjectId]));
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [
        hostId,
        foreignHostId,
        assignedOrganizationId,
        removableOrganizationId,
        candidateOrganizationId,
        raceOrganizationId,
      ]),
    );
  await db.delete(user).where(inArray(user.id, [userId]));
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("removes an unreferenced Partnership", async () => {
    await expect(
      client.projectPartnerships.remove({ id: removablePartnershipId }),
    ).resolves.toEqual({ id: removablePartnershipId, removed: true });
  });

  it("translates the represented-Organization removal block safely", async () => {
    await expect(
      client.projectPartnerships.remove({ id: assignedPartnershipId }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
        error: { code: "FORBIDDEN" },
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
});
