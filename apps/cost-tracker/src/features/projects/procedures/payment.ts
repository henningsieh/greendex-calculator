import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
} from "@greendex/database/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { decimalUnits } from "@/features/projects/procedures/payable";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const claimInput = z.object({ partnershipId: coordinationId });
const result = z.object({
  id: z.string(),
  status: z.enum(["approved", "paid"]),
  approvedAmountEur: z.string(),
});

/** Call only after the bank confirms one full transfer; a failed transfer is not a Claim event. */
export const markPaid = authorized
  .input(
    claimInput.extend({
      amountEur: z
        .string()
        .regex(/^\d+(?:\.\d{1,2})?$/, "Enter exact EUR cents."),
    }),
  )
  .output(result)
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    if (scope.hostId !== context.session.activeOrganizationId)
      throw createSituationErrors(errors).hostingPaymentRequired();
    return db.transaction(async (tx) => {
      // Shared Project → Partnership → Claim lock order (claim-locks.ts) so
      // payment cannot race a decision or payout change.
      const { claim } = await lockClaimScope(
        tx,
        { projectId: scope.projectId, partnershipId: input.partnershipId },
        errors,
      );
      if (!claim) throw createSituationErrors(errors).claimNotFound();
      if (!["approved", "paid"].includes(claim.status))
        throw createSituationErrors(errors).claimApprovalRequired();
      if (claim.approvedAmountEur === null) {
        console.error("Approved/paid Claim lacks an approved amount");
        throw createSituationErrors(errors).internalFailure();
      }
      if (
        decimalUnits(input.amountEur, 2) !==
          decimalUnits(claim.approvedAmountEur, 2) ||
        decimalUnits(input.amountEur, 2) <= BigInt(0)
      )
        throw createSituationErrors(errors).fullTransferRequired();
      // Repeating the same confirmed transfer does not create another payment or history entry.
      if (claim.status === "paid")
        return {
          id: claim.id,
          status: "paid" as const,
          approvedAmountEur: claim.approvedAmountEur,
        };
      await tx
        .update(claims)
        .set({ status: "paid" })
        .where(eq(claims.id, claim.id));
      await tx.insert(history).values({
        claimId: claim.id,
        actorUserId: context.user.id,
        eventType: "paid",
      });
      return {
        id: claim.id,
        status: "paid" as const,
        approvedAmountEur: claim.approvedAmountEur,
      };
    });
  });

/** Corrects an application flag, not the bank transfer; the original paid event remains. */
export const correctPayment = authorized
  .input(claimInput.extend({ reason: z.string().trim().min(1).max(2000) }))
  .output(result)
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
      );
      if (claim?.status === "approved" && claim.approvedAmountEur !== null) {
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
            approvedAmountEur: claim.approvedAmountEur,
          };
      }
      if (!claim) throw createSituationErrors(errors).claimNotFound();
      if (claim.status !== "paid")
        throw createSituationErrors(errors).claimPaidRequired();
      if (claim.approvedAmountEur === null) {
        console.error("Paid Claim lacks an approved amount");
        throw createSituationErrors(errors).internalFailure();
      }
      await tx
        .update(claims)
        .set({ status: "approved" })
        .where(eq(claims.id, claim.id));
      await tx.insert(history).values({
        claimId: claim.id,
        actorUserId: context.user.id,
        eventType: "payment_corrected",
        reason: input.reason,
      });
      return {
        id: claim.id,
        status: "approved" as const,
        approvedAmountEur: claim.approvedAmountEur,
      };
    });
  });
