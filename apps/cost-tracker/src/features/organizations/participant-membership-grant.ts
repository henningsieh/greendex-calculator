import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import "server-only";
import { addOrganizationRole, hasOrganizationRole } from "@greendex/auth";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { getOrgAdapter, type Member } from "better-auth/plugins/organization";
import { z } from "zod";

import { costTrackerOrganizationHooks } from "@/features/organizations/roles";

/**
 * Vendor-body code for a stale expected role on the server-only participant
 * grant. The joining procedure maps it to the established MEMBERSHIP_CHANGED
 * situation (safe retry with a fresh read); every other grant failure keeps
 * the privileged-membership safe error contract.
 */
export const participantGrantChangedCode = "MEMBERSHIP_CHANGED";

const grantParticipantMembershipBody = z.object({
  userId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  expectedRole: z.string().min(1).max(512),
});

function staleMembership() {
  return new APIError("BAD_REQUEST", {
    code: participantGrantChangedCode,
    message: "Membership changed during join; please retry.",
  });
}

// Server-only participant grant (ADR-0013). The endpoint declares no path, so
// like Better Auth's own addMember it is reachable only through auth.api and
// never over HTTP or from a browser client. Authorization stays with the
// calling procedure, which has already verified the User, the entry token,
// the Project and the agreement; this endpoint only appends the participant
// role to that Hosting Membership, preserving every existing role.
const grantParticipantMembership = createAuthEndpoint(
  {
    method: "POST",
    body: grantParticipantMembershipBody,
  },
  async (ctx) => {
    // No org options: they only select additional-field filtering, which Cost
    // Tracker does not configure, so the default adapter shape applies.
    const adapter = getOrgAdapter(ctx.context);
    const membership = await adapter.findMemberByOrgId({
      userId: ctx.body.userId,
      organizationId: ctx.body.organizationId,
    });
    if (!membership)
      throw new APIError("BAD_REQUEST", {
        message: "Membership not found.",
      });
    // Resume is idempotent: a previous attempt may have granted the role
    // before its application writes failed.
    if (hasOrganizationRole(membership.role, ORGANIZATION_ROLES.Participant))
      return ctx.json({ member: membership });
    if (membership.role !== ctx.body.expectedRole) throw staleMembership();
    // ADR-0012: the fallback role is forbidden everywhere in Cost Tracker, so
    // the combined role runs through the same gate as every native role write.
    const newRole = addOrganizationRole(membership.role, ORGANIZATION_ROLES.Participant);
    const organization = await adapter.findOrganizationById(
      ctx.body.organizationId,
    );
    if (!organization)
      throw new APIError("BAD_REQUEST", {
        message: "Organization not found.",
      });
    const user = await ctx.context.internalAdapter.findUserById(
      membership.userId,
    );
    if (!user) throw new APIError("BAD_REQUEST", { message: "User not found." });
    // The adapter row carries its joined user; narrow to the hook's member
    // shape instead of widening the hook.
    const hookResponse =
      await costTrackerOrganizationHooks.beforeUpdateMemberRole?.({
        member: membership as Member,
        newRole,
        user,
        organization,
      });
    const roleToWrite =
      hookResponse &&
      typeof hookResponse === "object" &&
      "data" in hookResponse &&
      typeof hookResponse.data?.role === "string"
        ? hookResponse.data.role
        : newRole;
    // Why not native updateMemberRole: Better Auth 1.7.7 offers no privileged
    // variant. The native endpoint requires the caller session to already hold
    // member:update in the target Organization, which a joining Group Organizer
    // never has; granting it would broaden the client-reachable endpoint to any
    // member-role write (ADR-0015 minimal grant). This pathless server-only
    // endpoint performs the same write after the calling procedure authorized it.
    const updated = await adapter.updateMember(membership.id, roleToWrite);
    if (!updated) throw staleMembership();
    return ctx.json({ member: updated });
  },
);

export const participantMembershipGrantPlugin = {
  id: "cost-tracker-participant-membership-grant",
  endpoints: { grantParticipantMembership },
} satisfies BetterAuthPlugin;
