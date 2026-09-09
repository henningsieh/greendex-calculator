// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveProjectRelationship } from "@/features/projects/project-relationship.server";

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

describe("Project relationship resolver", () => {
  it("resolves the Hosting Organization relationship", async () => {
    await expect(
      resolveProjectRelationship({
        activeOrganizationId: hostingOrganizationId,
        projectId,
      }),
    ).resolves.toMatchObject({ kind: "hosted", projectId, archived: false });
  });

  it("resolves the assigned Partner Organization relationship", async () => {
    await expect(
      resolveProjectRelationship({
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
      resolveProjectRelationship({
        activeOrganizationId: unrelatedOrganizationId,
        projectId,
      }),
    ).resolves.toEqual({ kind: "inaccessible" });
    await expect(
      resolveProjectRelationship({
        activeOrganizationId: hostingOrganizationId,
        projectId: "missing-project",
      }),
    ).resolves.toEqual({ kind: "inaccessible" });
  });

  it("preserves archived state for detail authorization", async () => {
    await expect(
      resolveProjectRelationship({
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
