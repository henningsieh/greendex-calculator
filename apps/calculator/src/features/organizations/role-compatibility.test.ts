import { describe, expect, it, vi } from "vitest";

import { canonicalCalculatorRole } from "./types";

describe("Calculator role compatibility", () => {
  it.each(["owner", "admin", "member", "participant"])(
    "keeps the existing %s role unchanged",
    (role) => {
      expect(canonicalCalculatorRole(role)).toBe(role);
    },
  );

  it("ignores an appended coordinator role while retaining the original authority", () => {
    expect(canonicalCalculatorRole("admin,project-coordinator")).toBe("admin");
    expect(canonicalCalculatorRole("owner,project-coordinator")).toBe("owner");
    expect(canonicalCalculatorRole("member,project-coordinator")).toBe("member");
  });

  it("does not change Calculator's client-side permissions for appended roles", async () => {
    const { authClient } = await vi.importActual<
      typeof import("@/lib/better-auth/auth-client")
    >("@/lib/better-auth/auth-client");
    for (const role of ["admin", "member"] as const) {
      for (const permission of ["create", "read", "delete"] as const) {
        const allowed = authClient.organization.checkRolePermission({
          role,
          permissions: { project: [permission] },
        });
        const appended = authClient.organization.checkRolePermission({
          role: `${role},project-coordinator` as typeof role,
          permissions: { project: [permission] },
        });
        expect(appended).toBe(allowed);
      }
    }
  });

  it("never grants Calculator privileges to an unknown role alone", () => {
    expect(canonicalCalculatorRole("project-coordinator")).toBeNull();
    expect(canonicalCalculatorRole("unknown")).toBeNull();
  });
});
