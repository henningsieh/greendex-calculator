import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  hasOrganizationRole,
  legacyCalculatorMemberRole,
  organizationRoles,
  organizationAdministratorRole,
  parseOrganizationRoles,
  projectParticipantRole,
  calculatorOrganizationRoles,
  projectCoordinatorRole,
  costTrackerOrganizationRoles,
} from "./permissions";

describe("organization permissions", () => {
  it("gives organization administrators full project and partnership access", () => {
    expect(
      organizationAdministratorRole.authorize({
        project: ["delete"],
        projectPartnership: ["delete"],
        projectParticipation: ["merge"],
      }).success,
    ).toBe(true);
  });

  it("gates assignment-scoped coordinator role to Cost Tracker without granting broad project or organization access", () => {
    expect(costTrackerOrganizationRoles["project-coordinator"]).toBe(
      projectCoordinatorRole,
    );
    expect(projectCoordinatorRole.authorize({ project: ["read"] }).success).toBe(
      false,
    );
    expect(
      projectCoordinatorRole.authorize({ projectPartnership: ["create"] })
        .success,
    ).toBe(false);
    expect(
      projectCoordinatorRole.authorize({ organization: ["update"] }).success,
    ).toBe(false);
    expect(
      costTrackerOrganizationRoles.admin.authorize({ project: ["update"] })
        .success,
    ).toBe(true);
    expect(Object.keys(organizationRoles)).not.toContain("project-coordinator");
    expect(Object.keys(costTrackerOrganizationRoles)).not.toContain("member");
  });

  it("keeps project coordinators from deleting projects", () => {
    expect(
      projectCoordinatorRole.authorize({ project: ["delete"] }).success,
    ).toBe(false);
    expect(
      projectCoordinatorRole.authorize({ project: ["update"] }).success,
    ).toBe(false);
  });

  it("gives participants personal read and update access without partnership access", () => {
    expect(
      projectParticipantRole.authorize({
        project: ["read"],
        projectParticipation: ["read", "update"],
      }).success,
    ).toBe(true);
    expect(
      projectParticipantRole.authorize({ projectPartnership: ["read"] }).success,
    ).toBe(false);
  });

  it("does not treat a generic organization member as a participant", () => {
    expect(
      legacyCalculatorMemberRole.authorize({ project: ["read"] }).success,
    ).toBe(false);
    expect(organizationRoles.member).toBe(legacyCalculatorMemberRole);
    expect(calculatorOrganizationRoles.member).toBe(legacyCalculatorMemberRole);
  });
});

describe("definition-map rename preserves stored-role authority", () => {
  it("uses exactly the requested definition names, not new persisted role values", () => {
    expect(Object.keys(organizationRoles)).toEqual([
      "admin",
      "member",
      "organisationAdmin",
      "projectParticipant",
    ]);
    expect(Object.keys(calculatorOrganizationRoles)).toEqual([
      "owner",
      "admin",
      "member",
      "participant",
    ]);
    expect(Object.keys(costTrackerOrganizationRoles)).toEqual([
      "owner",
      "admin",
      "participant",
      "project-coordinator",
    ]);
  });

  it.each([
    "owner",
    "admin",
    "member",
    "participant",
    "owner,participant",
    "admin,participant",
  ])(
    "keeps the same stored user %s and every permission before/after",
    (storedRole) => {
      const sameUser = { id: "existing-calculator-user", role: storedRole };
      // The pre-rename runtime map, explicitly frozen from the original definitions.
      const before = {
        owner: organizationAdministratorRole,
        admin: organizationRoles.admin,
        member: legacyCalculatorMemberRole,
        participant: projectParticipantRole,
      };
      for (const role of sameUser.role.split(",") as (keyof typeof before)[]) {
        expect(calculatorOrganizationRoles[role]).toBe(before[role]);
        expect(calculatorOrganizationRoles[role].statements).toEqual(
          before[role].statements,
        );
        if (role !== "member") {
          expect(costTrackerOrganizationRoles[role]).toBe(before[role]);
        }
      }
      expect(sameUser.role).toBe(storedRole);
    },
  );
});

describe("membership roles", () => {
  it("parses comma-separated roles without losing coexisting authority", () => {
    expect(parseOrganizationRoles("owner, participant")).toEqual([
      "owner",
      "participant",
    ]);
    expect(hasOrganizationRole("owner,participant", "owner")).toBe(true);
    expect(hasOrganizationRole("owner,participant", "participant")).toBe(true);
  });

  it("ignores empty and unknown role values", () => {
    expect(parseOrganizationRoles("unknown, ,participant")).toEqual([
      "participant",
    ]);
  });

  it("adds a role without replacing or duplicating existing roles", () => {
    expect(addOrganizationRole("owner,custom", "participant")).toBe(
      "owner,custom,participant",
    );
    expect(addOrganizationRole("owner,participant", "participant")).toBe(
      "owner,participant",
    );
  });
});
