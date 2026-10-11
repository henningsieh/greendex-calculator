import "server-only";
import { db } from "@greendex/database";
import { participantEntryTokensTable as tokens } from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { id } from "@/features/authentication/procedures/shared";
import { requirePartnerScopeAuthority } from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildSetInvitationOpen() {
  return authorized
    .input(z.object({ invitationId: id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [token] = await db
        .select({
          partnershipId: tokens.partnershipId,
          email: tokens.email,
          status: tokens.status,
          expiresAt: tokens.expiresAt,
        })
        .from(tokens)
        .where(eq(tokens.id, input.invitationId))
        .limit(1);
      if (!token || token.email === null)
        throw createSituationErrors(errors).participantInvitationNotFound();
      await requirePartnerScopeAuthority(
        context.headers,
        token.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (token.status === "accepted")
        throw createSituationErrors(errors).participantInvitationAccepted();
      if (token.status !== "pending")
        throw createSituationErrors(errors).participantInvitationClosed();
      if (token.expiresAt !== null && token.expiresAt <= new Date())
        throw createSituationErrors(errors).participantInvitationExpired();
      // Revocation is terminal: reopening never resurrects a revoked identity
      // — reissue after revoke instead, mirroring newest-wins rotation.
      if (input.open) return { open: true };
      await db
        .update(tokens)
        .set({ status: "revoked" })
        .where(eq(tokens.id, input.invitationId));
      return { open: input.open };
    });
}
