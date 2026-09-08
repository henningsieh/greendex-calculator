import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
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

vi.mock("@/lib/auth", () => ({
  auth: { api: authMocks },
}));

import { router } from "@/lib/orpc/router";

const userId = randomUUID();
const organizationId = randomUUID();
const foreignOrganizationId = randomUUID();
const partnerOrganizationId = randomUUID();
const foreignPartnerOrganizationId = randomUUID();
const archivedPartnerOrganizationId = randomUUID();
const projectId = randomUUID();
const laterProjectId = randomUUID();
const foreignProjectId = randomUUID();
const archivedProjectId = randomUUID();
const partnershipId = randomUUID();
const laterPartnershipId = randomUUID();
const foreignPartnershipId = randomUUID();
const archivedPartnershipId = randomUUID();
const headers = new Headers();
const client = createRouterClient(router, { context: async () => ({ headers }) });

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: "Cost Tracker Procedure User",
    email: `cost-tracker-procedure-${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values([
    {
      id: organizationId,
      name: "Active Hosting Organization",
      slug: `active-host-${organizationId}`,
      createdAt: new Date(),
    },
    {
      id: foreignOrganizationId,
      name: "Foreign Hosting Organization",
      slug: `foreign-host-${foreignOrganizationId}`,
      createdAt: new Date(),
    },
    {
      id: partnerOrganizationId,
      name: "Assigned Partner Organization",
      slug: `assigned-partner-${partnerOrganizationId}`,
      createdAt: new Date(),
    },
    {
      id: foreignPartnerOrganizationId,
      name: "Foreign Partner Organization",
      slug: `foreign-partner-${foreignPartnerOrganizationId}`,
      createdAt: new Date(),
    },
    {
      id: archivedPartnerOrganizationId,
      name: "Archived Partner Organization",
      slug: `archived-partner-${archivedPartnerOrganizationId}`,
      createdAt: new Date(),
    },
  ]);
  await db.insert(projectsTable).values([
    {
      id: projectId,
      name: "Zebra Active Organization Project",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-05-03T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      responsibleUserId: userId,
      organizationId,
    },
    {
      id: laterProjectId,
      name: "Alpha Later Organization Project",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-03T00:00:00.000Z"),
      location: "Hamburg",
      country: "DE",
      responsibleUserId: userId,
      organizationId,
    },
    {
      id: foreignProjectId,
      name: "Foreign Organization Project",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-03T00:00:00.000Z"),
      location: "Paris",
      country: "FR",
      responsibleUserId: userId,
      organizationId: foreignOrganizationId,
    },
    {
      id: archivedProjectId,
      name: "Archived Organization Project",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-03T00:00:00.000Z"),
      location: "Cologne",
      country: "DE",
      responsibleUserId: userId,
      organizationId,
      archived: true,
    },
  ]);
  await db.insert(projectPartnerOrganizationsTable).values([
    {
      id: partnershipId,
      projectId,
      organizationId: partnerOrganizationId,
    },
    {
      id: laterPartnershipId,
      projectId: laterProjectId,
      organizationId: partnerOrganizationId,
    },
    {
      id: foreignPartnershipId,
      projectId: foreignProjectId,
      organizationId: foreignPartnerOrganizationId,
    },
    {
      id: archivedPartnershipId,
      projectId: archivedProjectId,
      organizationId: archivedPartnerOrganizationId,
    },
  ]);
});

beforeEach(() => {
  vi.clearAllMocks();
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId: organizationId },
    user: {
      id: userId,
      name: "Cost Tracker Procedure User",
      email: `cost-tracker-procedure-${userId}@example.com`,
    },
  });
  authMocks.hasPermission.mockResolvedValue({ success: true });
});

afterAll(async () => {
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(eq(projectPartnerOrganizationsTable.id, partnershipId));
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(eq(projectPartnerOrganizationsTable.id, laterPartnershipId));
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(eq(projectPartnerOrganizationsTable.id, foreignPartnershipId));
  await db
    .delete(projectPartnerOrganizationsTable)
    .where(eq(projectPartnerOrganizationsTable.id, archivedPartnershipId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, laterProjectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, foreignProjectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, archivedProjectId));
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(organization).where(eq(organization.id, foreignOrganizationId));
  await db.delete(organization).where(eq(organization.id, partnerOrganizationId));
  await db
    .delete(organization)
    .where(eq(organization.id, foreignPartnerOrganizationId));
  await db
    .delete(organization)
    .where(eq(organization.id, archivedPartnerOrganizationId));
  await db.delete(user).where(eq(user.id, userId));
});

describe("Cost Tracker Project procedures", () => {
  it("lists only active-Organization Projects as explicit DTOs", async () => {
    const projects = await client.projects.list();

    expect(projects).toEqual([
      {
        id: projectId,
        name: "Zebra Active Organization Project",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-03T00:00:00.000Z"),
        location: "Berlin",
        costSubmissionWindowOpen: false,
        partnerOrganizationCount: 1,
      },
      {
        id: laterProjectId,
        name: "Alpha Later Organization Project",
        startDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: new Date("2026-07-03T00:00:00.000Z"),
        location: "Hamburg",
        costSubmissionWindowOpen: false,
        partnerOrganizationCount: 1,
      },
    ]);
    expect(projects[0]).not.toHaveProperty("organizationId");
    expect(projects[0]).not.toHaveProperty("responsibleUserId");
    expect(authMocks.hasPermission).toHaveBeenCalledWith({
      headers,
      body: { permissions: { project: ["read"] } },
    });
  });

  it("lists Partner Organizations only through active-Organization Projects", async () => {
    const partners = await client.partnerOrganizations.list();

    expect(partners).toEqual([
      {
        id: partnerOrganizationId,
        name: "Assigned Partner Organization",
        projectNames: [
          "Alpha Later Organization Project",
          "Zebra Active Organization Project",
        ],
      },
    ]);
    expect(partners[0]).not.toHaveProperty("slug");
    expect(authMocks.hasPermission).toHaveBeenCalledWith({
      headers,
      body: {
        permissions: {
          project: ["read"],
          projectPartnership: ["read"],
        },
      },
    });
  });

  it("rejects unauthenticated procedure calls with the typed error contract", async () => {
    authMocks.getSession.mockResolvedValue(null);

    await expect(client.projects.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(authMocks.hasPermission).not.toHaveBeenCalled();
  });

  it("rejects sessions without an active Organization", async () => {
    authMocks.getSession.mockResolvedValue({
      session: { id: randomUUID(), userId, activeOrganizationId: null },
      user: {
        id: userId,
        name: "Cost Tracker Procedure User",
        email: `cost-tracker-procedure-${userId}@example.com`,
      },
    });

    await expect(client.projects.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(authMocks.hasPermission).not.toHaveBeenCalled();
  });

  it("rejects active members without the dedicated read permission", async () => {
    authMocks.hasPermission.mockResolvedValue({ success: false });

    await expect(client.projects.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
