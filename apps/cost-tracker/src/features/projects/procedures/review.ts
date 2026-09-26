import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { authorized } from "@/lib/orpc/middleware";

const claimInput = z.object({ partnershipId: coordinationId });
const reviewInput = claimInput.extend({
  reason: z.string().trim().max(2000).optional(),
});
const result = z.object({
  id: z.string(),
  status: z.enum(["correction_requested", "approved", "rejected", "submitted"]),
  approvedAmountEur: z.string().nullable(),
});
type Decision = "requestCorrection" | "approve" | "reject" | "reopen";

function decision(action: Decision) {
  return authorized
    .input(reviewInput)
    .output(result)
    .handler(async ({ input, context, errors }) => {
      if (
        (action === "reject" || action === "requestCorrection") &&
        !input.reason
      )
        throw errors.BAD_REQUEST({ message: "A review reason is required." });
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.hostId !== context.session.activeOrganizationId)
        throw errors.FORBIDDEN({
          message: "Only Hosting staff may review Claims.",
        });
      return db.transaction(async (tx) => {
        // Same Project → Partnership → Claim lock order as submission.
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
        const expectedStatus = action === "reopen" ? "rejected" : "submitted";
        const nextStatus =
          action === "requestCorrection"
            ? "correction_requested"
            : action === "reopen"
              ? "submitted"
              : action === "approve"
                ? "approved"
                : "rejected";
        const eventType = action === "reopen" ? "reopened" : nextStatus;
        if (claim?.status === nextStatus) {
          const [latest] = await tx
            .select({ eventType: history.eventType, reason: history.reason })
            .from(history)
            .where(eq(history.claimId, claim.id))
            .orderBy(desc(history.occurredAt), desc(history.id))
            .limit(1);
          if (
            latest?.eventType === eventType &&
            ((action !== "reject" && action !== "requestCorrection") ||
              latest.reason === input.reason)
          )
            return {
              id: claim.id,
              status: nextStatus,
              approvedAmountEur: claim.approvedAmountEur,
            };
        }
        if (
          !claim ||
          claim.status !== expectedStatus ||
          (action === "approve" && claim.approvedAmountEur === null)
        )
          throw errors.BAD_REQUEST({
            message: `Claim must be ${expectedStatus} for this review decision.`,
          });
        const status = nextStatus;
        const reason =
          action === "reject" || action === "requestCorrection"
            ? input.reason
            : undefined;
        await tx.update(claims).set({ status }).where(eq(claims.id, claim.id));
        await tx.insert(history).values({
          claimId: claim.id,
          actorUserId: context.user.id,
          eventType:
            action === "requestCorrection"
              ? "correction_requested"
              : action === "reopen"
                ? "reopened"
                : status,
          reason,
        });
        return {
          id: claim.id,
          status,
          approvedAmountEur: claim.approvedAmountEur,
        };
      });
    });
}

export const getHistory = authorized
  .input(claimInput)
  .output(
    z.array(
      z.object({
        eventType: z.enum([
          "submitted",
          "correction_requested",
          "resubmitted",
          "approved",
          "rejected",
          "reopened",
          "paid",
          "payment_corrected",
        ]),
        actorUserId: z.string(),
        occurredAt: z.date(),
        reason: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context, errors }) => {
    await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db
      .select({
        eventType: history.eventType,
        actorUserId: history.actorUserId,
        occurredAt: history.occurredAt,
        reason: history.reason,
      })
      .from(history)
      .innerJoin(claims, eq(claims.id, history.claimId))
      .where(eq(claims.partnershipId, input.partnershipId))
      .orderBy(asc(history.occurredAt), asc(history.id));
  });

export const requestCorrection = decision("requestCorrection");
export const approve = decision("approve");
export const reject = decision("reject");
export const reopen = decision("reopen");
