import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable,
  participantEntryTokensTable as tokens,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { id } from "@/features/authentication/procedures/shared";
import { canPartnerEditClaim } from "@/features/projects/claim-lifecycle";
import { requirePartnerScopeAuthority } from "@/features/projects/procedures/participant-entry";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildSetRegistrationLinkOpen() {
  return authorized
    .input(z.object({ id, open: z.boolean() }))
    .output(z.object({ open: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const [token] = await db
        .select({ partnershipId: tokens.partnershipId, email: tokens.email })
        .from(tokens)
        .where(eq(tokens.id, input.id))
        .limit(1);
      if (!token || token.email !== null)
        throw createSituationErrors(errors).registrationLinkNotFound();
      await requirePartnerScopeAuthority(
        context.headers,
        token.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (input.open) {
        // Reopening registration admits further Participants, so it follows
        // the one shared Partner Claim editing rule (ADR-0017): a submitted,
        // approved, rejected or paid Claim keeps registration closed, while a
        // correction request reopens it with every other Partner edit.
        const [claim] = await db
          .select({ status: claimsTable.status })
          .from(claimsTable)
          .where(eq(claimsTable.partnershipId, token.partnershipId))
          .limit(1);
        if (claim && !canPartnerEditClaim(claim.status))
          throw createSituationErrors(errors).registrationClaimLocked();
      }
      await db
        .update(tokens)
        .set({
          status: input.open ? "pending" : "revoked",
          closedAt: input.open ? null : new Date(),
          closedByUserId: input.open ? null : context.user.id,
        })
        .where(eq(tokens.id, input.id));
      return { open: input.open };
    });
}
