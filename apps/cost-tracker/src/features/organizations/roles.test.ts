import { describe, expect, it } from "vitest";

import {
  BANNED_ROLE_MESSAGE,
  costTrackerOrganizationHooks,
  requireCostTrackerRole,
} from "@/features/organizations/roles";

describe("Cost Tracker role ban (ADR-0012)", () => {
  it.each([
    "member",
    " member ",
    "owner,member",
    "member,project-coordinator",
    "participant,member",
    null,
    undefined,
  ])("refuses the fallback role or an omitted default: %s", (role) => {
    expect(() => requireCostTrackerRole(role)).toThrow(BANNED_ROLE_MESSAGE);
  });

  it.each([
    "owner",
    "admin",
    "project-coordinator",
    "participant",
    "admin,participant",
    "project-coordinator,participant",
  ])("preserves the real domain role %s", (role) => {
    expect(() => requireCostTrackerRole(role)).not.toThrow();
  });

  it("gates native invitation creation, acceptance, membership addition, and role update before side effects", async () => {
    // Hook arguments irrelevant to role validation are deliberately not persisted.
    type Hooks = typeof costTrackerOrganizationHooks;
    await expect(
      costTrackerOrganizationHooks.beforeCreateInvitation!({
        invitation: { role: "member" },
      } as Parameters<NonNullable<Hooks["beforeCreateInvitation"]>>[0]),
    ).rejects.toThrow(BANNED_ROLE_MESSAGE);
    await expect(
      costTrackerOrganizationHooks.beforeAcceptInvitation!({
        invitation: { role: "member" },
      } as Parameters<NonNullable<Hooks["beforeAcceptInvitation"]>>[0]),
    ).rejects.toThrow(BANNED_ROLE_MESSAGE);
    await expect(
      costTrackerOrganizationHooks.beforeAddMember!({
        member: { role: "member" },
      } as Parameters<NonNullable<Hooks["beforeAddMember"]>>[0]),
    ).rejects.toThrow(BANNED_ROLE_MESSAGE);
    await expect(
      costTrackerOrganizationHooks.beforeUpdateMemberRole!({
        newRole: "owner,member",
      } as Parameters<NonNullable<Hooks["beforeUpdateMemberRole"]>>[0]),
    ).rejects.toThrow(BANNED_ROLE_MESSAGE);
  });
});
