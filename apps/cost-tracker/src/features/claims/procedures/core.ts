import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canPartnerEditClaim,
  evaluateClaimTransition,
} from "@/features/claims/claim-lifecycle";
import { lockClaimScope } from "@/features/claims/procedures/claim-locks";
import { PayoutAccountCreateSchema } from "@/features/claims/validation-schemas";
import {
  ClaimDraftSchema,
  ClaimPartnershipInputSchema,
  ClaimStatusSchema,
  PayoutAccountIdSchema,
} from "@/features/claims/validation-schemas";
import { requirePartnerCoordination } from "@/features/partnerships/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const accountSchema = z.object({
  id: z.string(),
  accountHolder: z.string(),
  iban: z.string(),
  bic: z.string().nullable(),
});

async function requirePartnerSide(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Parameters<typeof requirePartnerCoordination>[3],
) {
  const scope = await requirePartnerCoordination(
    partnershipId,
    actorId,
    activeOrganizationId,
    errors,
  );
  if (scope.partnerId !== activeOrganizationId) {
    throw createSituationErrors(errors).partnerClaimEditRequired();
  }
  return scope;
}

/** Reading the workspace never starts a Claim. */
export const getDraft = authorized
  .input(ClaimPartnershipInputSchema)
  .output(
    z
      .object({
        id: z.string(),
        partnershipId: z.string(),
        reimbursementAmountEur: z.string().nullable(),
        status: ClaimStatusSchema,
      })
      .nullable(),
  )
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Get the editable claim draft",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [claim] = await db
      .select({
        id: claims.id,
        partnershipId: claims.partnershipId,
        status: claims.status,
        reimbursementAmountEur: claims.reimbursementAmountEur,
      })
      .from(claims)
      .where(eq(claims.partnershipId, input.partnershipId))
      .limit(1);
    return claim ?? null;
  });

/** List only this Partner's accounts and the Partnership's current selection. */
export const listPayoutAccounts = authorized
  .input(ClaimPartnershipInputSchema)
  .output(
    z.object({
      accounts: z.array(
        z.object({
          id: z.string(),
          accountHolder: z.string(),
          iban: z.string(),
          bic: z.string().nullable(),
        }),
      ),
      selectedPayoutAccountId: z.string().nullable(),
    }),
  )
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "List payout accounts",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [available, selected] = await Promise.all([
      db
        .select({
          id: accounts.id,
          accountHolder: accounts.accountHolder,
          iban: accounts.iban,
          bic: accounts.bic,
        })
        .from(accounts)
        .where(eq(accounts.organizationId, scope.partnerId)),
      db
        .select({ payoutAccountId: selections.payoutAccountId })
        .from(selections)
        .innerJoin(
          accounts,
          and(
            eq(accounts.id, selections.payoutAccountId),
            eq(accounts.organizationId, scope.partnerId),
          ),
        )
        .where(eq(selections.partnershipId, input.partnershipId))
        .limit(1),
    ]);
    return {
      accounts: available,
      selectedPayoutAccountId: selected[0]?.payoutAccountId ?? null,
    };
  });

/** Create an Organization-owned account without selecting it or starting a Claim. */
export const createPayoutAccount = authorized
  .input(
    ClaimPartnershipInputSchema.extend(PayoutAccountCreateSchema.shape).extend({
      bic: PayoutAccountCreateSchema.shape.bic
        .optional()
        .transform((value) => value || null),
    }),
  )
  .output(accountSchema)
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Create a payout account",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [account] = await db
      .insert(accounts)
      .values({
        organizationId: scope.partnerId,
        accountHolder: input.accountHolder,
        iban: input.iban,
        bic: input.bic,
      })
      .returning({
        id: accounts.id,
        accountHolder: accounts.accountHolder,
        iban: accounts.iban,
        bic: accounts.bic,
      });
    return account;
  });

/** Select by reference on the Partnership, without starting a Claim. */
export const selectPayoutAccount = authorized
  .input(
    ClaimPartnershipInputSchema.extend({
      payoutAccountId: PayoutAccountIdSchema,
    }),
  )
  .output(z.object({ partnershipId: z.string(), payoutAccountId: z.string() }))
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Select the payout account for a claim",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db.transaction(async (tx) => {
      // Shared lock order: selection and first save serialize on the Partnership.
      const { claim } = await lockClaimScope(
        tx,
        {
          projectId: scope.projectId,
          partnershipId: input.partnershipId,
          partnerOrganizationId: scope.partnerId,
        },
        errors,
        "partnership",
      );
      if (claim && !canPartnerEditClaim(claim.status)) {
        throw createSituationErrors(errors).payoutSelectionLocked();
      }
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, input.payoutAccountId),
            eq(accounts.organizationId, scope.partnerId),
          ),
        )
        .limit(1);
      if (!account)
        throw createSituationErrors(errors).partnerPayoutSelectionRequired();
      await tx
        .insert(selections)
        .values(input)
        .onConflictDoUpdate({
          target: selections.partnershipId,
          set: { payoutAccountId: input.payoutAccountId },
        });
      return input;
    });
  });

/** Explicit first save: unique Partnership key and row lock make retries idempotent. */
export const saveDraft = authorized
  .input(ClaimPartnershipInputSchema)
  .output(ClaimDraftSchema)
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Create the claim",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db.transaction(async (tx) => {
      // Shared lock order: first save and payout selection serialize on the Partnership.
      const { claim } = await lockClaimScope(
        tx,
        {
          projectId: scope.projectId,
          partnershipId: input.partnershipId,
          partnerOrganizationId: scope.partnerId,
        },
        errors,
        "partnership",
      );
      const [selected] = await tx
        .select({ id: selections.payoutAccountId })
        .from(selections)
        .innerJoin(
          accounts,
          and(
            eq(accounts.id, selections.payoutAccountId),
            eq(accounts.organizationId, scope.partnerId),
          ),
        )
        .where(eq(selections.partnershipId, input.partnershipId))
        .limit(1);
      if (claim) {
        if (!selected)
          throw createSituationErrors(errors).payoutAccountRequired();
        if (!canPartnerEditClaim(claim.status))
          throw createSituationErrors(errors).claimNotEditable();
        return ClaimDraftSchema.parse(claim);
      }
      const decision = evaluateClaimTransition(null, "create", {
        payoutAccount: Boolean(selected),
      });
      if (decision.kind === "refused")
        throw createSituationErrors(errors).payoutAccountRequired();
      const [created] = await tx
        .insert(claims)
        .values({ ...input, status: decision.state })
        .onConflictDoNothing({ target: claims.partnershipId })
        .returning({
          id: claims.id,
          partnershipId: claims.partnershipId,
          status: claims.status,
        });
      if (created) return { ...created, status: decision.state };
      const [raced] = await tx
        .select({
          id: claims.id,
          partnershipId: claims.partnershipId,
          status: claims.status,
        })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (!raced) {
        console.error("Claim insert conflict returned no scoped Claim");
        throw createSituationErrors(errors).internalFailure();
      }
      if (canPartnerEditClaim(raced.status)) return ClaimDraftSchema.parse(raced);
      throw createSituationErrors(errors).claimNotEditable();
    });
  });
