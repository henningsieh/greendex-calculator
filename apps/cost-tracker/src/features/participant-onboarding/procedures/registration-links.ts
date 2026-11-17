import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable,
  participantEntryTokensTable as tokens,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { canPartnerEditClaim } from "@/features/claims/claim-lifecycle";
import { issueEntryToken } from "@/features/participant-onboarding/procedures/entry-tokens";
import { requirePartnerScopeAuthority } from "@/features/participant-onboarding/procedures/participant-entry";
import {
  CreateParticipantRegistrationLinkInputSchema,
  SetParticipantRegistrationLinkOpenInputSchema,
} from "@/features/participant-onboarding/validation-schemas";
import { lockActiveProject } from "@/features/projects/procedures/project-lock";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export function buildCreateRegistrationLink() {
  return authorized
    .input(CreateParticipantRegistrationLinkInputSchema)
    .output(z.object({ id: z.string(), secret: z.string() }))
    .meta(
      openapi({
        tags: ["Access"],
        summary: "Create a shareable participant registration link",
      }),
    )
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
      const issued = await db.transaction(async (tx) => {
        await lockActiveProject(tx, partnership.projectId, errors);
        return issueEntryToken(
          errors,
          {
            partnershipId: partnership.id,
            projectId: partnership.projectId,
            email: null,
            expiresAt: null,
            issuedByUserId: context.user.id,
          },
          tx,
        );
      });
      return { id: issued.id, secret: issued.secret };
    });
}

export function buildSetRegistrationLinkOpen() {
  return authorized
    .input(SetParticipantRegistrationLinkOpenInputSchema)
    .output(z.object({ open: z.boolean() }))
    .meta(
      openapi({
        tags: ["Access"],
        summary: "Enable or disable a registration link",
      }),
    )
    .handler(async ({ input, context, errors }) => {
      const [token] = await db
        .select({ partnershipId: tokens.partnershipId, email: tokens.email })
        .from(tokens)
        .where(eq(tokens.id, input.id))
        .limit(1);
      if (!token || token.email !== null)
        throw createSituationErrors(errors).registrationLinkNotFound();
      const scope = await requirePartnerScopeAuthority(
        context.headers,
        token.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      return db.transaction(async (tx) => {
        await lockActiveProject(tx, scope.projectId, errors);
        const [locked] = await tx
          .select({ id: tokens.id, email: tokens.email })
          .from(tokens)
          .where(and(eq(tokens.id, input.id), eq(tokens.partnershipId, scope.id)))
          .for("update")
          .limit(1);
        if (!locked || locked.email !== null)
          throw createSituationErrors(errors).registrationLinkNotFound();
        if (input.open) {
          // Reopening registration admits further Participants, so it follows
          // the one shared Partner Claim editing rule (ADR-0017): a submitted,
          // approved, rejected or paid Claim keeps registration closed, while a
          // correction request reopens it with every other Partner edit.
          const [claim] = await tx
            .select({ status: claimsTable.status })
            .from(claimsTable)
            .where(eq(claimsTable.partnershipId, token.partnershipId))
            .limit(1);
          if (claim && !canPartnerEditClaim(claim.status))
            throw createSituationErrors(errors).registrationClaimLocked();
        }
        await tx
          .update(tokens)
          .set({
            status: input.open ? "pending" : "revoked",
            closedAt: input.open ? null : new Date(),
            closedByUserId: input.open ? null : context.user.id,
          })
          .where(eq(tokens.id, input.id));
        return { open: input.open };
      });
    });
}
