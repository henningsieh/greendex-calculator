import { ORGANIZATION_ROLES } from "@greendex/auth";
import { is, Param, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  BANNED_ROLE_MESSAGE,
  costTrackerOrganizationHooks,
  memberHasParticipantAccess,
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

describe("memberHasParticipantAccess", () => {
  function accessPattern(): string {
    const fragment = memberHasParticipantAccess(sql`role`);
    for (const chunk of fragment.queryChunks) {
      if (typeof chunk === "string" && chunk.startsWith(",(")) return chunk;
      if (
        is(chunk, Param) &&
        typeof chunk.value === "string" &&
        chunk.value.startsWith(",(")
      )
        return chunk.value;
    }
    throw new Error("participant-access pattern missing from SQL fragment");
  }

  // The predicate wraps the stored role in commas, so evaluate the same way.
  function matches(pattern: string, role: string): boolean {
    return new RegExp(pattern).test(`,${role},`);
  }

  it("derives the participant-reader alternation from the auth role constants", () => {
    expect(accessPattern()).toBe(
      `,(${[ORGANIZATION_ROLES.Participant, ORGANIZATION_ROLES.OrganizationAdministrator, ORGANIZATION_ROLES.OrganizationAdmin].join("|")}),`,
    );
  });

  it.each([
    "participant",
    "owner",
    "admin",
    "owner,participant",
    "project-coordinator,participant",
  ])("matches %s", (role) => {
    expect(matches(accessPattern(), role)).toBe(true);
  });

  it.each(["project-coordinator", "member", "ownerx", ""])(
    "rejects %s",
    (role) => {
      expect(matches(accessPattern(), role)).toBe(false);
    },
  );
});
