// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  isStaffOrganizationRole,
  resolveStaffOrganizationContext,
} from "@/features/organizations/staff-eligibility";

const owner = { id: "org-a", name: "Alpha", role: "owner" };
const participant = { id: "org-b", name: "Beta", role: "participant" };

describe("isStaffOrganizationRole", () => {
  it.each([
    ["owner", true],
    ["admin", true],
    ["project-coordinator", true],
    ["owner,participant", true],
    ["participant", false],
    ["member", false],
    ["unknown-role", false],
    ["", false],
  ])("classifies %s as staff=%s", (role, staff) => {
    expect(isStaffOrganizationRole(role)).toBe(staff);
  });

  it("treats a missing role as non-staff", () => {
    expect(isStaffOrganizationRole(null)).toBe(false);
    expect(isStaffOrganizationRole(undefined)).toBe(false);
  });
});

describe("resolveStaffOrganizationContext", () => {
  it("reports no-membership when the caller belongs nowhere", () => {
    expect(
      resolveStaffOrganizationContext({
        memberships: [],
        activeOrganizationId: null,
      }),
    ).toEqual({ status: "no-membership" });
  });

  it("reports select when no active Organization is set", () => {
    expect(
      resolveStaffOrganizationContext({
        memberships: [owner],
        activeOrganizationId: null,
      }),
    ).toEqual({ status: "select", memberships: [owner] });
  });

  it("reports select when the active context is stale or revoked", () => {
    expect(
      resolveStaffOrganizationContext({
        memberships: [owner],
        activeOrganizationId: "org-deleted",
      }),
    ).toEqual({ status: "select", memberships: [owner] });
  });

  it("renders the shell with a switcher for staff Memberships", () => {
    expect(
      resolveStaffOrganizationContext({
        memberships: [owner, participant],
        activeOrganizationId: "org-a",
      }),
    ).toEqual({
      status: "ready",
      memberships: [owner, participant],
      activeOrganizationId: "org-a",
      showSwitcher: true,
    });
  });

  it("keeps mixed-role Users on staff flows when parked in a Participant Membership", () => {
    const resolved = resolveStaffOrganizationContext({
      memberships: [owner, participant],
      activeOrganizationId: "org-b",
    });

    expect(resolved).toEqual({
      status: "ready",
      memberships: [owner, participant],
      activeOrganizationId: "org-b",
      showSwitcher: true,
    });
  });

  it("renders the shell without a switcher for pure Participants", () => {
    expect(
      resolveStaffOrganizationContext({
        memberships: [participant],
        activeOrganizationId: "org-b",
      }),
    ).toEqual({
      status: "ready",
      memberships: [participant],
      activeOrganizationId: "org-b",
      showSwitcher: false,
    });
  });
});
