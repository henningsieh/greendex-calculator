import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  participantJourneysTable as journeys,
  payoutAccountsTable as accounts,
  partnershipPayoutAccountsTable as selections,
  proofDocumentsTable as documents,
  projectParticipantsTable as participants,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as links,
} from "@greendex/database/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
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
        throw createSituationErrors(errors).reviewReasonRequired();
      const scope = await requirePartnerCoordination(
        input.partnershipId,
        context.user.id,
        context.session.activeOrganizationId,
        errors,
      );
      if (scope.hostId !== context.session.activeOrganizationId)
        throw createSituationErrors(errors).hostingClaimReviewRequired();
      return db.transaction(async (tx) => {
        // Shared Project → Partnership → Claim lock order (claim-locks.ts).
        const { claim } = await lockClaimScope(
          tx,
          { projectId: scope.projectId, partnershipId: input.partnershipId },
          errors,
          "project",
        );
        if (
          action === "approve" &&
          claim &&
          ["submitted", "approved"].includes(claim.status) &&
          claim.approvedAmountEur === null
        ) {
          console.error("Submitted/approved Claim lacks an approved amount");
          throw createSituationErrors(errors).internalFailure();
        }
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
        if (!claim) throw createSituationErrors(errors).claimNotFound();
        if (claim.status !== expectedStatus)
          throw action === "reopen"
            ? createSituationErrors(errors).claimRejectedRequired()
            : createSituationErrors(errors).claimSubmittedRequired();
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

// Rendering hint only. Mutations independently repeat the authoritative scope check.
export const reviewerAccess = authorized
  .input(claimInput)
  .output(z.object({ canReview: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return { canReview: scope.hostId === context.session.activeOrganizationId };
  });

/** Hosting-only, read-only snapshot for Claim review; no editable drafts or storage keys leave this boundary. */
export const getReviewDetails = authorized
  .input(claimInput)
  .output(
    z.object({
      payoutAccount: z
        .object({
          accountHolder: z.string(),
          iban: z.string(),
          bic: z.string().nullable(),
        })
        .nullable(),
      entries: z.array(
        z.object({
          id: z.string(),
          transportProfile: z.string(),
          amountEur: z.string(),
          allocationMethod: z.string(),
          allocations: z.array(
            z.object({
              participantId: z.string(),
              participantName: z.string(),
              percentage: z.string().nullable(),
              amountEur: z.string().nullable(),
            }),
          ),
          documents: z.array(
            z.object({
              id: z.string(),
              originalFileName: z.string(),
              mediaType: z.string(),
              byteSize: z.number(),
            }),
          ),
        }),
      ),
      journeys: z.array(
        z.object({
          participantId: z.string(),
          participantName: z.string(),
          origin: z.string(),
          destination: z.string(),
          tripType: z.string(),
          erasmusDistanceKm: z.string(),
        }),
      ),
      approvedAmountEur: z.string().nullable(),
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
      throw createSituationErrors(errors).hostingClaimReviewRequired();
    const [claim] = await db
      .select({
        id: claims.id,
        status: claims.status,
        approvedAmountEur: claims.approvedAmountEur,
      })
      .from(claims)
      .where(eq(claims.partnershipId, input.partnershipId))
      .limit(1);
    if (!claim) throw createSituationErrors(errors).claimNotFound();
    if (
      ![
        "submitted",
        "correction_requested",
        "approved",
        "rejected",
        "paid",
      ].includes(claim.status)
    )
      throw createSituationErrors(errors).claimReviewUnavailable();
    const [payout, costRows, journeyRows] = await Promise.all([
      db
        .select({
          accountHolder: accounts.accountHolder,
          iban: accounts.iban,
          bic: accounts.bic,
        })
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
      db
        .select({
          id: entries.id,
          transportProfile: entries.transportProfile,
          amountEur: entries.amountEur,
          allocationMethod: entries.allocationMethod,
        })
        .from(entries)
        .where(eq(entries.claimId, claim.id)),
      db
        .select({
          participantId: participants.id,
          participantName: participants.displayName,
          origin: journeys.origin,
          destination: journeys.destination,
          tripType: journeys.tripType,
          erasmusDistanceKm: journeys.erasmusDistanceKm,
        })
        .from(journeys)
        .innerJoin(
          participants,
          eq(participants.id, journeys.projectParticipantId),
        )
        .where(
          and(
            eq(participants.projectId, scope.projectId),
            eq(participants.representedOrganizationId, scope.partnerId),
          ),
        ),
    ]);
    const ids = costRows.map((row) => row.id);
    const [shares, evidence] = ids.length
      ? await Promise.all([
          db
            .select({
              travelCostEntryId: allocations.travelCostEntryId,
              participantId: participants.id,
              participantName: participants.displayName,
              percentage: allocations.percentage,
              amountEur: allocations.amountEur,
            })
            .from(allocations)
            .innerJoin(
              participants,
              eq(participants.id, allocations.projectParticipantId),
            )
            .where(inArray(allocations.travelCostEntryId, ids)),
          db
            .select({
              travelCostEntryId: links.travelCostEntryId,
              id: documents.id,
              originalFileName: documents.originalFileName,
              mediaType: documents.mediaType,
              byteSize: documents.byteSize,
            })
            .from(links)
            .innerJoin(
              documents,
              and(
                eq(documents.id, links.proofDocumentId),
                eq(documents.claimId, claim.id),
              ),
            )
            .where(inArray(links.travelCostEntryId, ids)),
        ])
      : [[], []];
    return {
      payoutAccount: payout[0] ?? null,
      approvedAmountEur: claim.approvedAmountEur,
      journeys: journeyRows,
      entries: costRows.map((row) => ({
        ...row,
        allocations: shares
          .filter((share) => share.travelCostEntryId === row.id)
          .map(({ participantId, participantName, percentage, amountEur }) => ({
            participantId,
            participantName,
            percentage,
            amountEur,
          })),
        documents: evidence
          .filter((document) => document.travelCostEntryId === row.id)
          .map(({ id, originalFileName, mediaType, byteSize }) => ({
            id,
            originalFileName,
            mediaType,
            byteSize,
          })),
      })),
    };
  });

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
          "journey_updated",
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
