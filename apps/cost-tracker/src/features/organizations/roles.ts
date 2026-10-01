import { APIError } from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins/organization";

export const BANNED_ROLE_MESSAGE =
  'The "member" role is forbidden in Cost Tracker. Use a defined Organization role.';

export function hasBannedOrganizationRole(
  role: string | null | undefined,
): boolean {
  return (
    role == null || role.split(",").some((value) => value.trim() === "member")
  );
}

// ADR-0012 bans Better Auth's fallback role, including combined roles and omitted defaults.
export function requireCostTrackerRole(
  role: string | null | undefined,
  badRequest: (args: { message: string }) => Error = (args) =>
    new APIError("BAD_REQUEST", args),
): void {
  if (hasBannedOrganizationRole(role)) {
    throw badRequest({ message: BANNED_ROLE_MESSAGE });
  }
}

export const costTrackerOrganizationHooks: NonNullable<
  OrganizationOptions["organizationHooks"]
> = {
  async beforeCreateInvitation({ invitation }) {
    requireCostTrackerRole(invitation.role);
  },
  async beforeAcceptInvitation({ invitation }) {
    requireCostTrackerRole(invitation.role);
  },
  async beforeAddMember({ member }) {
    requireCostTrackerRole(member.role);
  },
  async beforeUpdateMemberRole({ newRole }) {
    requireCostTrackerRole(newRole);
  },
};
