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

import { router } from "@/lib/orpc/router";

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

describe("Project detail procedure", () => {
  it("returns the Hosted-safe workspace shell", async () => {
    const detail = await client.projects.detail({ projectId });

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

    const detail = await client.projects.detail({ projectId });

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

    await expect(client.projects.detail({ projectId })).rejects.toMatchObject({
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

    await expect(client.projects.detail({ projectId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns UNAUTHORIZED without a session", async () => {
    authMocks.getSession.mockResolvedValue(null);

    await expect(client.projects.detail({ projectId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
