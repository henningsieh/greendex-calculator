import "server-only";
import { db } from "@greendex/database";
import {
  participantEntryTokensTable as tokens,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  invitationTokenExpiry,
  issueEntryToken,
  revokeEntryTokenInTransaction,
} from "@/features/authentication/procedures/entry-tokens";
import { deliverParticipantInvitation } from "@/features/authentication/procedures/invitation-delivery";
import {
  id,
  invitationResult,
  INVITATION_TTL_MS,
  normalizedEmail,
} from "@/features/authentication/procedures/shared";
import { requirePartnerScopeAuthority } from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildReissueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const target = await requirePartnerScopeAuthority(
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
      const issued = await db.transaction(async (tx) => {
        // Serialize rotations across every Partnership in this Project.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, target.projectId))
          .for("update");
        const [previous] = await tx
          .select({
            id: tokens.id,
            partnershipId: tokens.partnershipId,
          })
          .from(tokens)
          .where(
            and(
              eq(tokens.projectId, target.projectId),
              eq(tokens.email, input.email),
              eq(tokens.status, "pending"),
            ),
          )
          .limit(1);
        if (!previous)
          throw createSituationErrors(errors).participantInvitationNotFound();
        if (previous.partnershipId !== target.id)
          await requirePartnerScopeAuthority(
            context.headers,
            previous.partnershipId,
            context.user.id,
            context.session.activeOrganizationId,
            errors,
          );
        // Newest wins: the previous identity can no longer be redeemed.
        await revokeEntryTokenInTransaction(tx, previous.id);
        return issueEntryToken(
          errors,
          {
            partnershipId: target.id,
            projectId: target.projectId,
            email: input.email,
            expiresAt: invitationTokenExpiry(INVITATION_TTL_MS),
            issuedByUserId: context.user.id,
          },
          tx,
        );
      });
      // Only explicit reissue creates a new identity and triggers another delivery.
      return deliverParticipantInvitation(input.email, issued.id, issued.secret);
    });
}
