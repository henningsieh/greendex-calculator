import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { canPartnerEditClaim } from "@/features/projects/claim-lifecycle";
import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const partnershipInput = z.object({ partnershipId: coordinationId });
const accountSchema = z.object({
  id: z.string(),
  accountHolder: z.string(),
  iban: z.string(),
  bic: z.string().nullable(),
});

const accountHolderSchema = z.string().trim().min(1).max(200);
const ibanSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, "").toUpperCase())
  .pipe(
    z
      .string()
      .min(15)
      .max(34)
      .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/)
      .refine((iban) => {
        const rearranged = iban.slice(4) + iban.slice(0, 4);
        let remainder = 0;
        for (const character of rearranged) {
          const digits = /[A-Z]/.test(character)
            ? String(character.charCodeAt(0) - 55)
            : character;
          for (const digit of digits)
            remainder = (remainder * 10 + Number(digit)) % 97;
        }
        return remainder === 1;
      }, "Invalid IBAN checksum."),
  );
const bicSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toUpperCase()))
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/)
      .nullable(),
  )
  .optional()
  .transform((value) => value ?? null);
const draftSchema = z.object({
  id: z.string(),
  partnershipId: z.string(),
  status: z.enum(["editable", "correction_requested"]),
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
  .input(partnershipInput)
  .output(
    z
      .object({
        id: z.string(),
        partnershipId: z.string(),
        approvedAmountEur: z.string().nullable(),
        status: z.enum([
          "editable",
          "submitted",
          "correction_requested",
          "approved",
          "rejected",
          "paid",
        ]),
      })
      .nullable(),
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
        approvedAmountEur: claims.approvedAmountEur,
      })
      .from(claims)
      .where(eq(claims.partnershipId, input.partnershipId))
      .limit(1);
    return claim ?? null;
  });

/** List only this Partner's accounts and the Partnership's current selection. */
export const listPayoutAccounts = authorized
  .input(partnershipInput)
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
    partnershipInput.extend({
      accountHolder: accountHolderSchema,
      iban: ibanSchema,
      bic: bicSchema,
    }),
  )
  .output(accountSchema)
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
  .input(partnershipInput.extend({ payoutAccountId: coordinationId }))
  .output(z.object({ partnershipId: z.string(), payoutAccountId: z.string() }))
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
  .input(partnershipInput)
  .output(draftSchema)
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
      if (!selected) throw createSituationErrors(errors).payoutAccountRequired();
      if (claim) {
        if (!canPartnerEditClaim(claim.status))
          throw createSituationErrors(errors).claimNotEditable();
        return draftSchema.parse(claim);
      }
      const [created] = await tx
        .insert(claims)
        .values(input)
        .onConflictDoNothing({ target: claims.partnershipId })
        .returning({
          id: claims.id,
          partnershipId: claims.partnershipId,
          status: claims.status,
        });
      if (created) return { ...created, status: "editable" as const };
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
      if (canPartnerEditClaim(raced.status)) return draftSchema.parse(raced);
      throw createSituationErrors(errors).claimNotEditable();
    });
  });
