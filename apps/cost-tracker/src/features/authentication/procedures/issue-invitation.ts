import "server-only";
import { randomBytes } from "node:crypto";

import { db } from "@greendex/database";
import {
  participantInvitationsTable as invitations,
  projectParticipantsTable as participants,
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

export function buildIssueInvitation() {
  return authorized
    .input(z.object({ partnershipId: id, email: normalizedEmail }))
    .output(invitationResult)
    .handler(async ({ input, context, errors }) => {
      const partnership = await requireParticipantEntryAuthority(
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
      const [existing] = await db
        .select({
          id: invitations.id,
          partnershipId: invitations.partnershipId,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.projectId, partnership.projectId),
            eq(invitations.email, input.email),
            eq(invitations.status, "pending"),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.partnershipId !== partnership.id)
          throw createSituationErrors(errors).participantAlreadyInvited();
        if (existing.expiresAt > new Date())
          // Idempotent issuance never resends and never recovers the secret:
          // only explicit reissue delivers again.
          return {
            invitationId: existing.id,
            secret: null,
            delivery: "already-issued" as const,
          };
        // Stale invitation: retire it and fall through to fresh issuance below.
        await db
          .update(invitations)
          .set({ status: "revoked" })
          .where(
            and(
              eq(invitations.id, existing.id),
              eq(invitations.status, "pending"),
            ),
          );
      }
      // Only the Partner Organization issues entry points. The invitation is
      // app-owned: durable issuance first, delivery afterwards, never a
      // Better Auth write (ADR-0013).
      const secret = randomBytes(32).toString("base64url");
      const [issued] = await db
        .insert(invitations)
        .values({
          partnershipId: partnership.id,
          projectId: partnership.projectId,
          email: input.email,
          secretHash: secretHash(secret),
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          issuedByUserId: context.user.id,
        })
        .returning({ id: invitations.id });
      if (!issued) throw createSituationErrors(errors).internalFailure();
      console.info("Participant invitation issued", {
        issuer: context.user.id,
        recipient: input.email,
        partnershipId: partnership.id,
        at: new Date().toISOString(),
      });
      return deliverParticipantInvitation(input.email, issued.id, secret);
    });
}
