// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Consume cross-app seed identities without loading the seed implementation. */

import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import { projectsTable as projects } from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import { router } from "@/lib/orpc/router";

import { SEED_ENTITY_SEARCH } from "../../../../../calculator/scripts/seed-scenarios";

// Stable identities registered in SEED_SCENARIOS.costTrackerEntitySearch.
const scenario = SEED_ENTITY_SEARCH;
const actor = SEED_IDS.user.entitySearchActor;
const host = SEED_IDS.organization.entitySearchHost;
const partner = SEED_IDS.organization.entitySearchPartner;
const foreign = SEED_IDS.organization.entitySearchForeign;
const assigned = SEED_IDS.project.entitySearchAssigned;
const unassigned = SEED_IDS.project.entitySearchUnassigned;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function session(activeOrganizationId: string | null = host, userId = actor) {
  authMocks.getSession.mockResolvedValue({
    session: { id: userId, userId, activeOrganizationId },
    user: { id: userId, email: `${userId}@example.com` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session();
  authMocks.hasPermission.mockResolvedValue({ success: true });
});

describe("entity picker procedures", () => {
  it("searches Organizations by ID or name with id/name projection and create permission", async () => {
    expect(
      await client.organizations.search({ search: partner.slice(0, 12) }),
    ).toEqual([{ id: partner, name: "Partner" }]);
    expect(await client.organizations.search({ search: partner })).toEqual([
      { id: partner, name: "Partner" },
    ]);
    expect(await client.organizations.search({ search: "%_" })).toEqual([]);
    await expect(
      client.organizations.search({ search: "p" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    authMocks.hasPermission.mockResolvedValue({ success: false });
    await expect(
      client.organizations.search({ search: "Part" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    session(null);
    await expect(
      client.organizations.search({ search: "Part" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Select an active Organization before accessing Cost Tracker data.",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
  });

  it("caps Organization search at 20 id/name matches", async () => {
    const result = await client.organizations.search({
      search: "Searchable",
    });
    expect(result).toHaveLength(20);
    expect(
      result.every((item) => Object.keys(item).sort().join() === "id,name"),
    ).toBe(true);
  });

  it("searches only owned Organizations by name or ID and enforces min 2", async () => {
    expect(await client.organizations.listMine({ search: partner })).toEqual([
      { id: partner, name: "Partner" },
    ]);
    expect(await client.organizations.listMine({ search: "Host" })).toEqual([
      { id: host, name: "Host" },
    ]);
    expect(await client.organizations.listMine({ search: foreign })).toEqual([]);
    expect(await client.organizations.listMine({ search: "%_" })).toEqual([]);
    await expect(
      client.organizations.listMine({ search: "p" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    authMocks.getSession.mockResolvedValue(null);
    await expect(
      client.organizations.listMine({ search: partner }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("uses hasOrganizationRole for the owned search predicate", async () => {
    const combinedRole = `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.OrganizationOwner}`;
    expect(
      hasOrganizationRole(combinedRole, ORGANIZATION_ROLES.OrganizationOwner),
    ).toBe(true);
    expect(await client.organizations.listMine({ search: partner })).toEqual([
      { id: partner, name: "Partner" },
    ]);
  });

  it("finds owned Organizations beyond the first 50 while capping each result at 20", async () => {
    const owned = scenario.ownedOrganizations;
    expect(
      await client.organizations.listMine({ search: "Owned Search" }),
    ).toHaveLength(20);
    expect(
      await client.organizations.listMine({ search: owned[54]!.id }),
    ).toEqual([{ id: owned[54]!.id, name: owned[54]!.name }]);
  });

  it("finds an owner after more than 1000 preceding non-owner matches", async () => {
    const last = scenario.manyOrganizations[1001]!;
    expect(
      await client.organizations.listMine({ search: "Many Matches" }),
    ).toEqual([{ id: last.id, name: last.name }]);
  }, 20_000);

  it("distinguishes Hosted search selection, Membership, and staff requirements", async () => {
    session(null);
    await expect(
      client.projects.searchHosted({ search: "" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Select an active Organization before accessing Cost Tracker data.",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    session("missing-organization");
    await expect(
      client.projects.searchHosted({ search: "" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Membership in the active Organization is required.",
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
    session(host, scenario.participantUserId);
    await expect(
      client.projects.searchHosted({ search: "" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "You need Hosting Organization Owner, Admin, or Project Coordinator access.",
      data: { reason: "HOSTING_STAFF_REQUIRED" },
    });
  });

  it("scopes hosted search by active host membership and coordinator assignment", async () => {
    // Pin distinct creation times so the empty-query ordering (newest first)
    // is proven, not inherited from alphabetical coincidence.
    await db
      .update(projects)
      .set({ createdAt: new Date("2024-01-01T00:00:00.000Z") })
      .where(eq(projects.id, assigned));
    await db
      .update(projects)
      .set({ createdAt: new Date("2024-06-01T00:00:00.000Z") })
      .where(eq(projects.id, unassigned));
    expect(await client.projects.searchHosted({ search: "Picker " })).toEqual([
      { id: assigned, name: "Picker Assigned Project" },
      { id: unassigned, name: "Picker Unassigned Project" },
    ]);
    // Browse preload: newest first. Typed search above stays alphabetical.
    expect(await client.projects.searchHosted({ search: "" })).toEqual([
      { id: unassigned, name: "Picker Unassigned Project" },
      { id: assigned, name: "Picker Assigned Project" },
    ]);
    session(host, scenario.coordinatorUserId);
    expect(await client.projects.searchHosted({ search: "Picker " })).toEqual([
      { id: assigned, name: "Picker Assigned Project" },
    ]);
    expect(await client.projects.searchHosted({ search: "" })).toEqual([
      { id: assigned, name: "Picker Assigned Project" },
    ]);
    session(host, scenario.unassignedCoordinatorUserId);
    expect(await client.projects.searchHosted({ search: "" })).toEqual([]);
    session(host, scenario.coordinatorUserId);
    await expect(
      client.projects.searchHosted({ search: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    session(foreign);
    await expect(
      client.projects.searchHosted({ search: "Picker " }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
