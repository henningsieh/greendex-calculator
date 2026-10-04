import "server-only";
import { db } from "@greendex/database";
import { participantInvitationsTable as invitations } from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { id } from "@/features/authentication/procedures/shared";
import { requireParticipantEntryAuthority } from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildSetInvitationOpen() {
  return authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [invitation] = await db
        .select({
          partnershipId: invitations.partnershipId,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(eq(invitations.id, input.invitationId))
        .limit(1);
      if (!invitation)
        throw createSituationErrors(errors).participantInvitationNotFound();
      await requireParticipantEntryAuthority(
        context.headers,
        invitation.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (invitation.status === "accepted")
        throw createSituationErrors(errors).participantInvitationAccepted();
      if (invitation.status !== "pending")
        throw createSituationErrors(errors).participantInvitationClosed();
      if (invitation.expiresAt <= new Date())
        throw createSituationErrors(errors).participantInvitationExpired();
      // Revocation is terminal: reopening never resurrects a revoked identity
      // — reissue after revoke instead, mirroring newest-wins rotation.
      if (input.open) return { open: true };
      await db
        .update(invitations)
        .set({ status: "revoked" })
        .where(eq(invitations.id, input.invitationId));
      return { open: input.open };
    });
}
