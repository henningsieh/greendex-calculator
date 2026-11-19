import { describe, expect, it } from "vitest";

import { organizationInitials } from "@/components/org-avatar";

describe("organizationInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(organizationInitials("Seed Organization")).toBe("SO");
    expect(organizationInitials("  Green   Energy Symposium ")).toBe("GE");
  });

  it("falls back to two letters for single-word names", () => {
    expect(organizationInitials("Greendex")).toBe("GR");
    expect(organizationInitials("A")).toBe("A");
  });

  it("marks empty names", () => {
    expect(organizationInitials("   ")).toBe("?");
  });
});
