import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  hasOrganizationRole,
  memberRole,
  organizationRoles,
  organizationAdministratorRole,
  parseOrganizationRoles,
  participantRole,
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
      participantRole.authorize({
        project: ["read"],
        projectParticipation: ["read", "update"],
      }).success,
    ).toBe(true);
    expect(
      participantRole.authorize({ projectPartnership: ["read"] }).success,
    ).toBe(false);
  });

  it("does not treat a generic organization member as a participant", () => {
    expect(memberRole.authorize({ project: ["read"] }).success).toBe(false);
  });
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
