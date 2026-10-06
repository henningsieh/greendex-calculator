import { member } from "@greendex/database/schema";
import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  hasOrganizationRole,
  ORGANIZATION_ROLES,
  parseOrganizationRoles,
} from "./organization-roles";

const roles = ORGANIZATION_ROLES;

describe("Organization roles", () => {
  it("defaults Memberships to the shared Participant role", () => {
    expect(member.role.default).toBe(roles.Participant);
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
