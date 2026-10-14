// @vitest-environment node

import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerEntitySearch.
const suffix = "canonical";
const scenario = {
  coordinatorUserId: "picker-coordinator-canonical",
  unassignedCoordinatorUserId: "picker-unassigned-coordinator-canonical",
  participantUserId: "picker-participant-canonical",
  ownedOrganizations: Array.from({ length: 55 }, (_, i) => ({
    id: `owned-result-${i}-${suffix}`,
    name: `Owned Search ${suffix} ${i.toString().padStart(2, "0")}`,
  })),
  manyOrganizations: Array.from({ length: 1002 }, (_, i) => ({
    id: `picker-many-${i.toString().padStart(4, "0")}-${suffix}`,
    name: `Many Matches ${suffix}`,
  })),
};
const actor = `picker-user-${suffix}`;
const host = `picker-host-${suffix}`;
const partner = `picker-partner-${suffix}`;
const foreign = `picker-foreign-${suffix}`;
const assigned = `picker-assigned-${suffix}`;
const unassigned = `picker-unassigned-${suffix}`;
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
    ).toEqual([{ id: partner, name: `Partner ${suffix}` }]);
    expect(
      await client.organizations.search({ search: `Partner ${suffix}` }),
    ).toEqual([{ id: partner, name: `Partner ${suffix}` }]);
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
      search: `Searchable ${suffix}`,
    });
    expect(result).toHaveLength(20);
    expect(
      result.every((item) => Object.keys(item).sort().join() === "id,name"),
    ).toBe(true);
  });

  it("searches only owned Organizations by name or ID and enforces min 2", async () => {
    expect(await client.organizations.listMine({ search: partner })).toEqual([
      { id: partner, name: `Partner ${suffix}` },
    ]);
    expect(
      await client.organizations.listMine({ search: `Host ${suffix}` }),
    ).toEqual([{ id: host, name: `Host ${suffix}` }]);
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
      { id: partner, name: `Partner ${suffix}` },
    ]);
  });

  it("finds owned Organizations beyond the first 50 while capping each result at 20", async () => {
    const owned = scenario.ownedOrganizations;
    expect(
      await client.organizations.listMine({ search: `Owned Search ${suffix}` }),
    ).toHaveLength(20);
    expect(
      await client.organizations.listMine({ search: owned[54]!.id }),
    ).toEqual([{ id: owned[54]!.id, name: owned[54]!.name }]);
  });

  it("finds an owner after more than 1000 preceding non-owner matches", async () => {
    const last = scenario.manyOrganizations[1001]!;
    expect(
      await client.organizations.listMine({ search: `Many Matches ${suffix}` }),
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
    expect(await client.projects.searchHosted({ search: "picker-" })).toEqual([
      { id: assigned, name: `Project ${assigned}` },
      { id: unassigned, name: `Project ${unassigned}` },
    ]);
    expect(await client.projects.searchHosted({ search: "" })).toEqual([
      { id: assigned, name: `Project ${assigned}` },
      { id: unassigned, name: `Project ${unassigned}` },
    ]);
    session(host, scenario.coordinatorUserId);
    expect(await client.projects.searchHosted({ search: "picker-" })).toEqual([
      { id: assigned, name: `Project ${assigned}` },
    ]);
    expect(await client.projects.searchHosted({ search: "" })).toEqual([
      { id: assigned, name: `Project ${assigned}` },
    ]);
    session(host, scenario.unassignedCoordinatorUserId);
    expect(await client.projects.searchHosted({ search: "" })).toEqual([]);
    session(host, scenario.coordinatorUserId);
    await expect(
      client.projects.searchHosted({ search: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    session(foreign);
    await expect(
      client.projects.searchHosted({ search: "picker-" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
