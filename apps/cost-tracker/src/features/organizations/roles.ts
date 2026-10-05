import { ORGANIZATION_ROLES, isValidOrganizationRole } from "@greendex/auth";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import { sql, type SQLWrapper } from "drizzle-orm";
import { z } from "zod";

export const BANNED_ROLE_MESSAGE =
  "Use a defined Organization role.";

// Host-organization Memberships carrying one of these roles read as
// Participants: owners and admins inherit Participant access, while a bare
// coordinator Membership alone does not.
const participantReaderRoles = [
  ORGANIZATION_ROLES.Participant,
  ORGANIZATION_ROLES.OrganizationOwner,
  ORGANIZATION_ROLES.OrganizationAdmin,
];

export function memberHasParticipantAccess(roleColumn: SQLWrapper) {
  return sql`(',' || ${roleColumn} || ',') ~ ${`,(${participantReaderRoles.join("|")}),`}`;
}

export function hasBannedOrganizationRole(
  role: string | null | undefined,
): boolean {
  return !isValidOrganizationRole(role);
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

const nativeInvitationInput = z.object({
  role: z.union([z.string(), z.array(z.string())]).optional(),
  email: z.string(),
  organizationId: z.string().optional(),
  resend: z.boolean().optional(),
});

// Better Auth 1.7 resends before beforeCreateInvitation, including expiry writes.
// Guard that native entry point before its handler, not just before new inserts.
export const costTrackerInvitationRoleGate: BetterAuthPlugin = {
  id: "cost-tracker-invitation-role-ban",
  hooks: {
    before: [
      {
        matcher: (context) => context.path === "/organization/invite-member",
        handler: createAuthMiddleware(async (context) => {
          const parsed = nativeInvitationInput.safeParse(context.body);
          if (!parsed.success) return; // The native input schema rejects malformed bodies.
          const input = parsed.data;
          requireCostTrackerRole(
            Array.isArray(input.role) ? input.role.join(",") : input.role,
          );
          if (!input.resend) return;
          const session = await getSessionFromCtx(context);
          const organizationId =
            input.organizationId ?? session?.session.activeOrganizationId;
          if (!session || !organizationId) return;
          const actor = await context.context.adapter.findOne<{ role: string }>({
            model: "member",
            where: [
              { field: "userId", value: session.user.id },
              { field: "organizationId", value: organizationId },
            ],
          });
          // Leave unauthorized requests to Better Auth; do not disclose pending roles.
          if (
            !actor?.role
              .split(",")
              .some((role) => [ORGANIZATION_ROLES.OrganizationOwner, ORGANIZATION_ROLES.OrganizationAdmin].some((knownRole) => knownRole === role.trim()))
          )
            return;
          const pending = await context.context.adapter.findMany<{
            role: string | null;
            expiresAt: Date;
          }>({
            model: "invitation",
            where: [
              { field: "email", value: input.email.toLowerCase() },
              { field: "organizationId", value: organizationId },
              { field: "status", value: "pending" },
            ],
          });
          for (const invitation of pending) {
            if (new Date(invitation.expiresAt) > new Date())
              requireCostTrackerRole(invitation.role);
          }
        }),
      },
    ],
  },
};

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
