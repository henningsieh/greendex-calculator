import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  calculatorOrganizationRoles,
  costTrackerOrganizationRoles,
  hasOrganizationRole,
  ORGANIZATION_ROLES,
  parseOrganizationRoles,
  projectCoordinatorRole,
} from "./permissions";

const roles = ORGANIZATION_ROLES;

describe("Organization permissions", () => {
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

  it("keeps Calculator admin Project management unchanged", () => {
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
