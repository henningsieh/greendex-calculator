import { ORGANIZATION_ROLES } from "@greendex/auth/organization-roles";
import { describe, expect, it } from "vitest";

import { canonicalCalculatorRole } from "./types";

describe("Calculator role compatibility", () => {
  // Exhaustive over the shared contract: a newly added role fails here
  // until it is placed in the calculator's priority order. No hand-listing.
  it.each(Object.values(ORGANIZATION_ROLES))(
    "keeps the existing %s role unchanged",
    (role) => {
      expect(canonicalCalculatorRole(role)).toBe(role);
    },
  );

  it("resolves the highest-priority role from a combined value", () => {
    expect(
      canonicalCalculatorRole(
        `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.OrganizationAdmin}`,
      ),
    ).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
  });

  it("returns null for unknown roles so callers fail closed", () => {
    expect(canonicalCalculatorRole("unknown")).toBeNull();
    expect(canonicalCalculatorRole("")).toBeNull();
  });
});
