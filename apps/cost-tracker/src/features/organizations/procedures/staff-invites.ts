import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import { invitation, member, user } from "@greendex/database/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { normalizedEmail } from "@/features/authentication/procedures/shared";
import { auth } from "@/lib/auth";
import { authorized } from "@/lib/orpc/middleware";

const STAFF_ROLES = ["owner", "admin", "member"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

const StaffRoleSchema = z.enum(STAFF_ROLES);

/** Lower rank outranks: an inviter can only grant their own rank or below. */
const ROLE_RANK: Record<StaffRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

const MemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

const PendingInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

const InviteInputSchema = z.object({
  email: normalizedEmail,
  role: StaffRoleSchema,
});

const CancelInputSchema = z.object({
  invitationId: z.string().min(1).max(128),
});

const InviteResultSchema = z.object({
  invitationId: z.string(),
  email: z.string(),
  role: StaffRoleSchema,
});

type ProcedureErrors = Parameters<Parameters<typeof authorized.use>[0]>[0];

function requireActiveOrganization(
  activeOrganizationId: string | null | undefined,
  errors: ProcedureErrors["errors"],
): string {
  if (!activeOrganizationId) {
    throw errors.FORBIDDEN({
      message: "Select an active Organization before managing its staff.",
    });
  }
  return activeOrganizationId;
}

/**
 * Loads the actor's membership and enforces owner/admin management scope.
 * Combined roles (for example "admin,participant") pass through
 * hasOrganizationRole semantics; assignment-only roles never grant access.
 */
async function requireOrganizationManager(
  userId: string,
  organizationId: string,
  errors: ProcedureErrors["errors"],
): Promise<StaffRole> {
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    throw errors.FORBIDDEN({
      message: "Organization management is unavailable.",
    });
  }

  if (hasOrganizationRole(membership.role, "owner")) return "owner";
  if (hasOrganizationRole(membership.role, "admin")) return "admin";

  throw errors.FORBIDDEN({
    message: "Organization management is unavailable.",
  });
}

export const listMembers = authorized
  .input(z.object({}).optional())
  .output(z.object({ members: z.array(MemberSchema) }))
  .handler(async ({ context, errors }) => {
    const organizationId = requireActiveOrganization(
      context.session.activeOrganizationId,
      errors,
    );
    await requireOrganizationManager(context.user.id, organizationId, errors);

    const rows = await db
      .select({
        id: member.id,
        userId: member.userId,
        name: user.name,
        email: user.email,
        role: member.role,
        createdAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId))
      .orderBy(asc(member.createdAt), asc(member.id));

    return {
      members: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });

export const listPendingInvitations = authorized
  .input(z.object({}).optional())
  .output(z.object({ invitations: z.array(PendingInvitationSchema) }))
  .handler(async ({ context, errors }) => {
    const organizationId = requireActiveOrganization(
      context.session.activeOrganizationId,
      errors,
    );
    await requireOrganizationManager(context.user.id, organizationId, errors);

    const rows = await db
      .select({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, "pending"),
        ),
      )
      .orderBy(desc(invitation.createdAt), asc(invitation.id));

    return {
      invitations: rows.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });

export const inviteMember = authorized
  .input(InviteInputSchema)
  .output(InviteResultSchema)
  .handler(async ({ context, errors, input }) => {
    const organizationId = requireActiveOrganization(
      context.session.activeOrganizationId,
      errors,
    );
    const actorRole = await requireOrganizationManager(
      context.user.id,
      organizationId,
      errors,
    );

    if (ROLE_RANK[input.role] < ROLE_RANK[actorRole]) {
      throw errors.FORBIDDEN({
        message: "This invitation would grant a role above your own.",
      });
    }

    let invitationId: string;
    try {
      const response = await auth.api.createInvitation({
        asResponse: true,
        headers: context.headers,
        body: {
          email: input.email,
          role: input.role,
          organizationId,
        },
      });
      if (!response.ok) {
        throw errors.BAD_REQUEST({
          message: "Could not send the invitation.",
        });
      }
      invitationId = z.object({ id: z.string() }).parse(await response.json()).id;
    } catch (error) {
      if (error instanceof ORPCError) throw error;
      console.error("Organization staff invitation failed", {
        organizationId,
        role: input.role,
      });
      throw errors.BAD_REQUEST({
        message: "Could not send the invitation.",
      });
    }

    return {
      invitationId,
      email: input.email,
      role: input.role,
    };
  });

export const cancelInvitation = authorized
  .input(CancelInputSchema)
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ context, errors, input }) => {
    const organizationId = requireActiveOrganization(
      context.session.activeOrganizationId,
      errors,
    );
    await requireOrganizationManager(context.user.id, organizationId, errors);

    const [pending] = await db
      .select({
        id: invitation.id,
        organizationId: invitation.organizationId,
        status: invitation.status,
      })
      .from(invitation)
      .where(eq(invitation.id, input.invitationId))
      .limit(1);

    if (!pending || pending.organizationId !== organizationId) {
      throw errors.NOT_FOUND({ message: "Invitation not found." });
    }
    if (pending.status !== "pending") {
      throw errors.BAD_REQUEST({
        message: "This invitation is no longer pending.",
      });
    }

    try {
      await auth.api.cancelInvitation({
        headers: context.headers,
        body: { invitationId: input.invitationId },
      });
    } catch {
      console.error("Organization staff invitation cancellation failed", {
        organizationId,
        invitationId: input.invitationId,
      });
      throw errors.BAD_REQUEST({
        message: "Could not cancel the invitation.",
      });
    }

    return { success: true as const };
  });
