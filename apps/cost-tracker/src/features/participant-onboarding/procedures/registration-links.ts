import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable,
  participantEntryTokensTable as tokens,
} from "@greendex/database/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { canPartnerEditClaim } from "@/features/claims/claim-lifecycle";
import { issueEntryToken } from "@/features/participant-onboarding/procedures/entry-tokens";
import { requirePartnerScopeAuthority } from "@/features/participant-onboarding/procedures/participant-entry";
import { id } from "@/features/participant-onboarding/procedures/shared";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildCreateRegistrationLink() {
  return authorized
    .input(z.object({ partnershipId: id }))
    .output(z.object({ id: z.string(), secret: z.string() }))
    .handler(async ({ input, context, errors }) => {
      const partnership = await requirePartnerScopeAuthority(
        context.headers,
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      // The shareable flavour binds no email and never expires: anyone holding
      // the secret may redeem it with their own account, repeatedly.
      const issued = await issueEntryToken(errors, {
        partnershipId: partnership.id,
        projectId: partnership.projectId,
        email: null,
        expiresAt: null,
        issuedByUserId: context.user.id,
      });
      return { id: issued.id, secret: issued.secret };
    });
}

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
