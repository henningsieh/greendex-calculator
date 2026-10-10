import "server-only";
import { db } from "@greendex/database";
import {
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  findPendingInvitationToken,
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

export function buildIssueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const partnership = await requirePartnerScopeAuthority(
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
            eq(participants.projectId, partnership.projectId),
            or(
              sql`lower(${participants.email}) = ${input.email}`,
              sql`lower(${user.email}) = ${input.email}`,
            ),
          ),
        )
        .limit(1);
      if (existingParticipation)
        throw createSituationErrors(errors).participantAlreadyParticipates();
      const result = await db.transaction(async (tx) => {
        // Share the Project lock with reissue: only the winning issuer delivers.
        await tx
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, partnership.projectId))
          .for("update");
        const existing = await findPendingInvitationToken(
          partnership.projectId,
          input.email,
          tx,
        );
        if (existing) {
          if (existing.partnershipId !== partnership.id)
            throw createSituationErrors(errors).participantAlreadyInvited();
          if (existing.expiresAt !== null && existing.expiresAt > new Date())
            return { kind: "already-issued", id: existing.id } as const;
          await revokeEntryTokenInTransaction(tx, existing.id);
        }
        const issued = await issueEntryToken(
          errors,
          {
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: input.email,
            expiresAt: invitationTokenExpiry(INVITATION_TTL_MS),
            issuedByUserId: context.user.id,
          },
          tx,
        );
        return { kind: "issued", ...issued } as const;
      });
      if (result.kind === "already-issued")
        return {
          invitationId: result.id,
          secret: null,
          delivery: "already-issued" as const,
        };
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, result.id, result.secret);
    });
}
