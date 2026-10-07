import { member } from "@greendex/database/schema";
import { describe, expect, it } from "vitest";

import {
  addOrganizationRole,
  hasOrganizationRole,
  isValidOrganizationRole,
  ORGANIZATION_ROLES,
  OrganizationRoleSchema,
  parseOrganizationRoles,
} from "./organization-roles";

const roles = ORGANIZATION_ROLES;

describe("Organization roles", () => {
  it("defaults Memberships to the shared Participant role", () => {
    expect(member.role.default).toBe(roles.Participant);
  });
});

describe("Organization role contract", () => {
  it("lists roles in descending hierarchy order", () => {
    expect(Object.keys(ORGANIZATION_ROLES)).toEqual([
      "OrganizationOwner",
      "OrganizationAdmin",
      "ProjectCoordinator",
      "Participant",
    ]);
  });

  it("uses distinct stored values", () => {
    const values = Object.values(ORGANIZATION_ROLES);
    expect(new Set(values).size).toBe(values.length);
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
  it("validates known roles and rejects unknown or missing ones", () => {
    expect(isValidOrganizationRole(roles.OrganizationAdmin)).toBe(true);
    expect(
      isValidOrganizationRole(`${roles.Participant},${roles.ProjectCoordinator}`),
    ).toBe(true);
    expect(isValidOrganizationRole("unknown")).toBe(false);
    expect(isValidOrganizationRole("admin,unknown")).toBe(false);
    expect(isValidOrganizationRole("")).toBe(false);
    expect(isValidOrganizationRole(null)).toBe(false);
    expect(isValidOrganizationRole(undefined)).toBe(false);
  });
  it("validates single and combined roles through the canonical schema", () => {
    expect(OrganizationRoleSchema.safeParse("unknown").success).toBe(false);
    for (const role of Object.values(ORGANIZATION_ROLES)) {
      expect(OrganizationRoleSchema.safeParse(role).success).toBe(true);
    }
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
