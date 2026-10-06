import { member } from "@greendex/database/schema";
import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  assertRoleMapCoversRoles,
  calculatorOrganizationRoles,
  costTrackerOrganizationRoles,
  hasOrganizationRole,
  ORGANIZATION_ROLES,
  parseOrganizationRoles,
  projectCoordinatorRole,
} from "./permissions";

const roles = ORGANIZATION_ROLES;

describe("role contract", () => {
  it("keeps canonical role keys in descending order", () => {
    expect(Object.keys(ORGANIZATION_ROLES)).toEqual([
      "OrganizationOwner",
      "OrganizationAdmin",
      "ProjectCoordinator",
      "Participant",
    ]);
  });

  it("keeps all role values distinct", () => {
    const values = Object.values(ORGANIZATION_ROLES);
    expect(new Set(values).size).toBe(values.length);
  });

  it("covers the ordered roles in both app maps", () => {
    expect(() =>
      assertRoleMapCoversRoles(calculatorOrganizationRoles),
    ).not.toThrow();
    expect(() =>
      assertRoleMapCoversRoles(costTrackerOrganizationRoles),
    ).not.toThrow();
  });

  it("validates structure without inspecting role contents", () => {
    expect(() =>
      assertRoleMapCoversRoles({
        owner: null,
        admin: null,
        coordinator: null,
        participant: null,
      }),
    ).not.toThrow();
  });

  it.each([
    { name: "missing", keys: ["owner", "admin", "coordinator"] },
    {
      name: "extra",
      keys: ["owner", "admin", "coordinator", "participant", "unknown"],
    },
    {
      name: "unknown",
      keys: ["owner", "admin", "coordinator", "unknown"],
    },
    {
      name: "reordered",
      keys: ["owner", "admin", "participant", "coordinator"],
    },
  ])("rejects $name role keys", ({ keys }) => {
    const roleMap = Object.fromEntries(keys.map((key) => [key, null]));
    expect(() => assertRoleMapCoversRoles(roleMap)).toThrow(
      "Role map must contain exactly these roles in order: owner, admin, coordinator, participant",
    );
  });
});

describe("Organization permissions", () => {
  it("defaults Memberships to the shared Participant role", () => {
    expect(member.role.default).toBe(roles.Participant);
  });

  it("uses the same final role values in both apps", () => {
    expect(Object.keys(calculatorOrganizationRoles).sort()).toEqual(
      Object.values(roles).sort(),
    );
    expect(Object.keys(costTrackerOrganizationRoles).sort()).toEqual(
      Object.values(roles).sort(),
    );
  });

  it("gives Organization Owners full Project and Partnership authority", () => {
    for (const map of [
      calculatorOrganizationRoles,
      costTrackerOrganizationRoles,
    ]) {
      expect(
        map[roles.OrganizationOwner].authorize({
          project: ["delete"],
          projectPartnership: ["delete"],
          projectParticipation: ["merge"],
        }).success,
      ).toBe(true);
    }
  });

  it("intentionally grants Calculator admins shared Project archive authority without delete", () => {
    expect(
      calculatorOrganizationRoles[roles.OrganizationAdmin].authorize({
        project: ["create", "read", "update", "archive"],
      }).success,
    ).toBe(true);
    expect(
      calculatorOrganizationRoles[roles.OrganizationAdmin].authorize({
        project: ["delete"],
      }).success,
    ).toBe(false);
  });

  it("grants Calculator coordinators nothing", () => {
    const coordinator = calculatorOrganizationRoles[roles.ProjectCoordinator];
    expect(coordinator.statements).toEqual({});
    expect(coordinator.authorize({ project: ["read"] }).success).toBe(false);
    expect(
      coordinator.authorize({ projectParticipation: ["create"] }).success,
    ).toBe(false);
    expect(coordinator.authorize({ organization: ["update"] }).success).toBe(
      false,
    );
  });

  it("keeps Cost Tracker coordination minimal and assignment-scoped", () => {
    const coordinator = costTrackerOrganizationRoles[roles.ProjectCoordinator];
    expect(coordinator).toBe(projectCoordinatorRole);
    expect(
      coordinator.authorize({ projectParticipation: ["create"] }).success,
    ).toBe(true);
    expect(coordinator.authorize({ project: ["read", "update"] }).success).toBe(
      false,
    );
    expect(
      coordinator.authorize({ projectPartnership: ["create"] }).success,
    ).toBe(false);
    expect(coordinator.authorize({ organization: ["update"] }).success).toBe(
      false,
    );
  });

  it("grants Participants personal read/update access, not Partnership access", () => {
    for (const map of [
      calculatorOrganizationRoles,
      costTrackerOrganizationRoles,
    ]) {
      expect(
        map[roles.Participant].authorize({
          project: ["read"],
          projectParticipation: ["read", "update"],
        }).success,
      ).toBe(true);
      expect(
        map[roles.Participant].authorize({ projectPartnership: ["read"] })
          .success,
      ).toBe(false);
    }
  });
});

describe("Membership roles", () => {
  it("preserves coexisting authority", () => {
    const combined = `${roles.OrganizationOwner}, ${roles.Participant}`;
    expect(parseOrganizationRoles(combined)).toEqual([
      roles.OrganizationOwner,
      roles.Participant,
    ]);
    expect(hasOrganizationRole(combined, roles.OrganizationOwner)).toBe(true);
  });
  it("ignores empty and unknown values", () => {
    expect(parseOrganizationRoles(`unknown, ,${roles.Participant}`)).toEqual([
      roles.Participant,
    ]);
  });
  it("adds without replacing or duplicating roles", () => {
    expect(addOrganizationRole(roles.ProjectCoordinator, roles.Participant)).toBe(
      `${roles.ProjectCoordinator},${roles.Participant}`,
    );
    expect(
      addOrganizationRole(
        `${roles.ProjectCoordinator},${roles.Participant}`,
        roles.Participant,
      ),
    ).toBe(`${roles.ProjectCoordinator},${roles.Participant}`);
  });
});
