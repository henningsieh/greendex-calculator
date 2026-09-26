import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { decimalUnits } from "@/features/projects/procedures/payable";
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
      throw errors.FORBIDDEN({
        message: "Only Hosting staff may record payment.",
      });
    return db.transaction(async (tx) => {
      // Match submission/review lock order so payment cannot race a decision or payout change.
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.id, scope.projectId), eq(projects.archived, false)),
        )
        .for("update")
        .limit(1);
      const [partnership] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.id, input.partnershipId),
            eq(partnerships.projectId, scope.projectId),
          ),
        )
        .for("update")
        .limit(1);
      if (!project || !partnership)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
      const [claim] = await tx
        .select({
          id: claims.id,
          status: claims.status,
          approvedAmountEur: claims.approvedAmountEur,
        })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .for("update")
        .limit(1);
      if (!claim || !["approved", "paid"].includes(claim.status))
        throw errors.BAD_REQUEST({
          message: "Claim must be approved and unpaid to record payment.",
        });
      if (
        claim.approvedAmountEur === null ||
        decimalUnits(input.amountEur, 2) !==
          decimalUnits(claim.approvedAmountEur, 2) ||
        decimalUnits(input.amountEur, 2) <= BigInt(0)
      )
        throw errors.BAD_REQUEST({
          message: "Transfer must equal the full approved EUR amount.",
        });
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
      throw errors.FORBIDDEN({
        message: "Only Hosting staff may correct payment.",
      });
    return db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(eq(projects.id, scope.projectId), eq(projects.archived, false)),
        )
        .for("update")
        .limit(1);
      const [partnership] = await tx
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(
          and(
            eq(partnerships.id, input.partnershipId),
            eq(partnerships.projectId, scope.projectId),
          ),
        )
        .for("update")
        .limit(1);
      if (!project || !partnership)
        throw errors.FORBIDDEN({
          message: "Project Partnership is unavailable.",
        });
      const [claim] = await tx
        .select({
          id: claims.id,
          status: claims.status,
          approvedAmountEur: claims.approvedAmountEur,
        })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .for("update")
        .limit(1);
      if (!claim || claim.status !== "paid" || claim.approvedAmountEur === null)
        throw errors.BAD_REQUEST({
          message: "Only a paid Claim can have its paid flag corrected.",
        });
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
