import "server-only";
import { randomBytes } from "node:crypto";

import { db } from "@greendex/database";
import {
  participantInvitationsTable as invitations,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { deliverParticipantInvitation } from "@/features/authentication/procedures/invitation-delivery";
import {
  id,
  invitationResult,
  INVITATION_TTL_MS,
  normalizedEmail,
  secretHash,
} from "@/features/authentication/procedures/shared";
import { requireParticipantEntryAuthority } from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildReissueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const target = await requireParticipantEntryAuthority(
        context.headers,
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      const [existingParticipation] = await db
        .select({ id: participants.id })
        .from(participants)
        .leftJoin(user, eq(user.id, participants.userId))
        .where(
          and(
            eq(participants.projectId, target.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw createSituationErrors(errors).participantAlreadyParticipates();
      const secret = randomBytes(32).toString("base64url");
      const issued = await db.transaction(async (tx) => {
        // Serialize rotations across every Partnership in this Project.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, target.projectId))
          .for("update");
        const [previous] = await tx
          .select({
            id: invitations.id,
            partnershipId: invitations.partnershipId,
          })
          .from(invitations)
          .where(
            and(
              eq(invitations.projectId, target.projectId),
              eq(invitations.email, input.email),
              eq(invitations.status, "pending"),
            ),
          )
          .limit(1);
        if (!previous)
          throw createSituationErrors(errors).participantInvitationNotFound();
        if (previous.partnershipId !== target.id)
          await requireParticipantEntryAuthority(
            context.headers,
            previous.partnershipId,
            context.user.id,
            context.session.activeOrganizationId,
            errors,
          );
        // Newest wins: the previous identity can no longer be redeemed.
        await tx
          .update(invitations)
          .set({ status: "revoked" })
          .where(
            and(
              eq(invitations.id, previous.id),
              eq(invitations.status, "pending"),
            ),
          );
        const [created] = await tx
          .insert(invitations)
          .values({
            partnershipId: target.id,
            projectId: target.projectId,
            email: input.email,
            secretHash: secretHash(secret),
            expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
            issuedByUserId: context.user.id,
          })
          .returning({ id: invitations.id });
        if (!created) throw createSituationErrors(errors).internalFailure();
        return created;
      });
      // Only explicit reissue creates a new identity and triggers another delivery.
      return deliverParticipantInvitation(input.email, issued.id, secret);
    });
}
