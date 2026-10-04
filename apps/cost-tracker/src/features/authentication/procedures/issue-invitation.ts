import "server-only";
import { db } from "@greendex/database";
import {
  projectParticipantsTable as participants,
  user,
} from "@greendex/database/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  findPendingInvitationToken,
  invitationTokenExpiry,
  issueEntryToken,
  revokeEntryToken,
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
      const existing = await findPendingInvitationToken(
        partnership.projectId,
        input.email,
      );
      if (existing) {
        if (existing.partnershipId !== partnership.id)
          throw createSituationErrors(errors).participantAlreadyInvited();
        if (existing.expiresAt !== null && existing.expiresAt > new Date())
          // Idempotent issuance never resends and never recovers the secret:
          // only explicit reissue delivers again.
          return {
            invitationId: existing.id,
            secret: null,
            delivery: "already-issued" as const,
          };
        // Stale invitation: retire it and fall through to fresh issuance below.
        await revokeEntryToken(existing.id);
      }
      // Only the Partner Organization issues entry points. The invitation is
      // app-owned: durable issuance first, delivery afterwards, never a
      // Better Auth write (ADR-0013).
      const issued = await issueEntryToken(errors, {
        partnershipId: partnership.id,
        projectId: partnership.projectId,
        email: input.email,
        expiresAt: invitationTokenExpiry(INVITATION_TTL_MS),
        issuedByUserId: context.user.id,
      });
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, issued.id, issued.secret);
    });
}
