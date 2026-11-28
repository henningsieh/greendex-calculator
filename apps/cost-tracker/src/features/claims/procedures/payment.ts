import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canRecordPayment,
  evaluateClaimTransition,
  MAX_CLAIM_REASON_LENGTH,
} from "@/features/claims/claim-lifecycle";
import { lockClaimScope } from "@/features/claims/procedures/claim-locks";
import { claimPaidNotificationIntent } from "@/features/claims/procedures/payment-notification";
import { decimalUnits } from "@/features/claims/reimbursement";
import { ClaimInputSchema } from "@/features/claims/validation-schemas";
import {
  declareNotifications,
  persistDeclaredNotifications,
} from "@/features/notifications/procedures/actions";
import { emitNotificationCreated } from "@/features/notifications/procedures/emit";
import { requirePartnerCoordination } from "@/features/partnerships/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const result = z.object({
  id: z.string(),
  status: z.enum(["approved", "paid"]),
  reimbursementAmountEur: z.string(),
});

/** Call only after the bank confirms one full transfer; a failed transfer is not a Claim event. */
const markPaidProcedure = authorized
  .input(
    ClaimInputSchema.extend({
      amountEur: z
        .string()
        .regex(/^\d+(?:\.\d{1,2})?$/, "Enter exact EUR cents."),
    }),
  )
  .output(result)
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Mark an approved claim as paid",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    if (scope.hostId !== context.session.activeOrganizationId)
      throw createSituationErrors(errors).hostingPaymentRequired();
    const outcome = await db.transaction(async (tx) => {
      // Shared Project → Partnership → Claim lock order (claim-locks.ts) so
      // payment cannot race a decision or payout change.
      const { claim } = await lockClaimScope(
        tx,
        { projectId: scope.projectId, partnershipId: input.partnershipId },
        errors,
        "project",
      );
      if (!claim) throw createSituationErrors(errors).claimNotFound();
      // The shared payment rule owns the permitted statuses; the amount check
      // below keeps the one-full-transfer invariant (ADR-0009).
      if (!canRecordPayment(claim.status))
        throw createSituationErrors(errors).claimApprovalRequired();
      if (claim.reimbursementAmountEur === null) {
        console.error("Approved/paid Claim lacks an approved amount");
        throw createSituationErrors(errors).internalFailure();
      }
      const amount = decimalUnits(input.amountEur, 2);
      const fullPayment =
        amount > 0n && amount === decimalUnits(claim.reimbursementAmountEur, 2);
      // Repeating the same confirmed transfer does not create another payment or history entry.
      if (claim.status === "paid") {
        if (!fullPayment)
          throw createSituationErrors(errors).fullTransferRequired();
        return {
          result: {
            id: claim.id,
            status: "paid" as const,
            reimbursementAmountEur: claim.reimbursementAmountEur,
          },
        };
      }
      const decision = evaluateClaimTransition(claim.status, "markPaid", {
        fullPayment,
      });
      if (decision.kind === "refused")
        throw decision.reason === "fullPayment"
          ? createSituationErrors(errors).fullTransferRequired()
          : createSituationErrors(errors).claimApprovalRequired();
      await tx
        .update(claims)
        .set({ status: decision.state })
        .where(eq(claims.id, claim.id));
      await tx.insert(history).values({
        claimId: claim.id,
        actorUserId: context.user.id,
        eventType: "paid",
      });
      // Same transaction as the status and history writes: a socket failure
      // can never roll the payment back, and duplicate pays insert nothing.
      const notifications = await persistDeclaredNotifications(
        tx,
        claimPaidNotificationIntent,
        {
          actorUserId: context.user.id,
          projectId: scope.projectId,
          partnershipId: input.partnershipId,
          partnerOrganizationId: scope.partnerId,
          claimId: claim.id,
          amountEur: claim.reimbursementAmountEur,
        },
      );
      return {
        result: {
          id: claim.id,
          status: decision.state,
          reimbursementAmountEur: claim.reimbursementAmountEur,
        },
        notifications,
      };
    });
    // Best-effort after commit: a failure is logged, the payment stands, and
    // the persisted rows remain the offline catch-up source of truth.
    if ("notifications" in outcome && outcome.notifications)
      await emitNotificationCreated(outcome.notifications);
    return outcome.result;
  });

export const markPaid = declareNotifications(
  markPaidProcedure,
  claimPaidNotificationIntent,
);

/** Corrects an application flag, not the bank transfer; the original paid event remains. */
export const correctPayment = authorized
  .input(
    ClaimInputSchema.extend({
      reason: z.string().trim().min(1).max(MAX_CLAIM_REASON_LENGTH),
    }),
  )
  .output(result)
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "Correct the paid flag of a claim",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    if (scope.hostId !== context.session.activeOrganizationId)
      throw createSituationErrors(errors).hostingPaymentCorrectionRequired();
    return db.transaction(async (tx) => {
      const { claim } = await lockClaimScope(
        tx,
        { projectId: scope.projectId, partnershipId: input.partnershipId },
        errors,
        "project",
      );
      if (claim?.status === "approved" && claim.reimbursementAmountEur !== null) {
        const [latest] = await tx
          .select({ eventType: history.eventType, reason: history.reason })
          .from(history)
          .where(eq(history.claimId, claim.id))
          .orderBy(desc(history.occurredAt), desc(history.id))
          .limit(1);
        if (
          latest?.eventType === "payment_corrected" &&
          latest.reason === input.reason
        )
          return {
            id: claim.id,
            status: "approved" as const,
            reimbursementAmountEur: claim.reimbursementAmountEur,
          };
      }
      if (!claim) throw createSituationErrors(errors).claimNotFound();
      const decision = evaluateClaimTransition(claim.status, "correctPayment", {
        reason: Boolean(input.reason),
      });
      if (decision.kind === "refused")
        throw createSituationErrors(errors).claimPaidRequired();
      if (claim.reimbursementAmountEur === null) {
        console.error("Paid Claim lacks an approved amount");
        throw createSituationErrors(errors).internalFailure();
      }
      await tx
        .update(claims)
        .set({ status: decision.state })
        .where(eq(claims.id, claim.id));
      await tx.insert(history).values({
        claimId: claim.id,
        actorUserId: context.user.id,
        eventType: "payment_corrected",
        reason: input.reason,
      });
      return {
        id: claim.id,
        status: decision.state,
        reimbursementAmountEur: claim.reimbursementAmountEur,
      };
    });
  });
