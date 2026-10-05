import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { describe, expect, it, vi } from "vitest";

import { canonicalCalculatorRole } from "./types";

describe("Calculator role compatibility", () => {
  it.each([
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.Participant,
  ])("keeps the existing %s role unchanged", (role) => {
    expect(canonicalCalculatorRole(role)).toBe(role);
  });

  it("ignores an appended coordinator role while retaining the original authority", () => {
    expect(
      canonicalCalculatorRole(
        `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      ),
    ).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
    expect(
      canonicalCalculatorRole(
        `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      ),
    ).toBe(ORGANIZATION_ROLES.OrganizationOwner);
    expect(
      canonicalCalculatorRole(
        `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      ),
    ).toBe(ORGANIZATION_ROLES.Participant);
  });

  it("does not change Calculator's client-side permissions for appended roles", async () => {
    const { authClient } = await vi.importActual<
      typeof import("@/lib/better-auth/auth-client")
    >("@/lib/better-auth/auth-client");
    for (const role of [
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.Participant,
    ] as const) {
      for (const permission of ["create", "read", "delete"] as const) {
        const allowed = authClient.organization.checkRolePermission({
          role,
          permissions: { project: [permission] },
        });
        const appended = authClient.organization.checkRolePermission({
          role: `${role},${ORGANIZATION_ROLES.ProjectCoordinator}` as typeof role,
          permissions: { project: [permission] },
        });
        expect(appended).toBe(allowed);
      }
    }
  });

  it("never grants Calculator privileges to a coordinator or unknown role alone", async () => {
    expect(
      canonicalCalculatorRole(ORGANIZATION_ROLES.ProjectCoordinator),
    ).toBeNull();
    const { calculatorOrganizationRoles } =
      await import("@greendex/auth/permissions");
    expect(
      calculatorOrganizationRoles[
        ORGANIZATION_ROLES.ProjectCoordinator
      ].authorize({ project: ["read"] }).success,
    ).toBe(false);
    expect(canonicalCalculatorRole("unknown")).toBeNull();
  });
});
