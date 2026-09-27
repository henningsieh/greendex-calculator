import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  projectPartnerOrganizationsTable as partnerships,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { claimLocksPartnerEdits } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { authorized } from "@/lib/orpc/middleware";

const partnershipInput = z.object({ partnershipId: coordinationId });
const draftSchema = z.object({
  id: z.string(),
  partnershipId: z.string(),
  status: z.enum(["editable", "correction_requested"]),
});
const selectedDraft = {
  id: claims.id,
  partnershipId: claims.partnershipId,
  status: claims.status,
  approvedAmountEur: claims.approvedAmountEur,
};

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
    throw errors.FORBIDDEN({
      message: "Only the Partner Organization may edit its Claim.",
    });
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
      .select(selectedDraft)
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
      // Serialize selection and first save (and other selection changes) per Partnership.
      const [partnership] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.id, input.partnershipId),
            eq(partnerships.organizationId, scope.partnerId),
          ),
        )
        .for("update")
        .limit(1);
      if (!partnership)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
      const [claim] = await tx
        .select({ status: claims.status })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (claim && claimLocksPartnerEdits(claim.status)) {
        throw errors.BAD_REQUEST({
          message:
            "Payout Account selection is locked while the Claim is not editable.",
        });
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
        throw errors.BAD_REQUEST({
          message:
            "Select a Payout Account belonging to the Partner Organization.",
        });
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
      const [partnership] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.id, input.partnershipId),
            eq(partnerships.organizationId, scope.partnerId),
          ),
        )
        .for("update")
        .limit(1);
      if (!partnership)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
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
      if (!selected)
        throw errors.BAD_REQUEST({
          message: "Select a Partner Payout Account before saving the Claim.",
        });
      const [existing] = await tx
        .select(selectedDraft)
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (existing) {
        if (claimLocksPartnerEdits(existing.status))
          throw errors.BAD_REQUEST({ message: "Claim is not editable." });
        return draftSchema.parse(existing);
      }
      const [created] = await tx
        .insert(claims)
        .values(input)
        .onConflictDoNothing({ target: claims.partnershipId })
        .returning(selectedDraft);
      if (created) return { ...created, status: "editable" as const };
      const [raced] = await tx
        .select(selectedDraft)
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (raced && !claimLocksPartnerEdits(raced.status))
        return draftSchema.parse(raced);
      throw errors.BAD_REQUEST({ message: "Claim is not editable." });
    });
  });
