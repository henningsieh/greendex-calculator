import { describe, expect, it } from "vitest";

import { ORGANIZATION_ROLES } from "./organization-roles";
import { calculatorOrganizationRoles } from "./permissions";

function projectActions(
  role: (typeof calculatorOrganizationRoles)[keyof typeof calculatorOrganizationRoles],
): readonly string[] {
  return role.statements.project;
}

describe("calculator role map", () => {
  it("grants Organization Administrator archive but not delete", () => {
    const actions = projectActions(
      calculatorOrganizationRoles[ORGANIZATION_ROLES.OrganizationAdmin],
    );
    expect(actions).toContain("archive");
    expect(actions).not.toContain("delete");
  });

  it("mirrors Project Coordinator on Organization Administrator minus archive", () => {
    const coordinator = projectActions(
      calculatorOrganizationRoles[ORGANIZATION_ROLES.ProjectCoordinator],
    );
    expect(coordinator).toEqual(["create", "read", "update"]);
    expect(coordinator).not.toContain("archive");
    expect(coordinator).not.toContain("delete");
  });

  it("keeps Participant read-only", () => {
    expect(
      projectActions(calculatorOrganizationRoles[ORGANIZATION_ROLES.Participant]),
    ).toEqual(["read"]);
  });

  it("grants Organization Owner everything", () => {
    const actions = projectActions(
      calculatorOrganizationRoles[ORGANIZATION_ROLES.OrganizationOwner],
    );
    expect(actions).toEqual(
      expect.arrayContaining(["create", "read", "update", "delete", "archive"]),
    );
  });
});
