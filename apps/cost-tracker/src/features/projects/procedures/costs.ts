import "server-only";
import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  costAllocationsTable as allocations,
  proofDocumentsTable as documents,
  projectParticipantsTable as participants,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as links,
} from "@greendex/database/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { isPartnerEditLocked } from "@/features/projects/claim-lifecycle";
import { lockClaimScope } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const scopeInput = z.object({ partnershipId: coordinationId });
const money = z
  .string()
  .regex(
    /^\d{1,12}(?:\.\d{1,2})?$/,
    "Enter a positive exact EUR amount with at most two decimal places.",
  );
const percentage = z
  .string()
  .regex(
    /^\d{1,3}(?:\.\d{1,6})?$/,
    "Enter a positive exact percentage with at most six decimal places.",
  );
const toUnits = (value: string, scale: number) => {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * BigInt(10) ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0"))
  );
};
const fromCents = (value: bigint) =>
  `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
const allocationInput = z.object({
  projectParticipantId: coordinationId,
  percentage: percentage.optional(),
  amountEur: money.optional(),
});
const saveInput = scopeInput
  .extend({
    entryId: coordinationId.optional(),
    transportProfile: z.string().min(1),
    amountEur: money,
    allocationMethod: z.enum(["equal", "percentage", "amount"]),
    allocations: z
      .array(allocationInput)
      .min(1, "Select at least one Participation."),
  })
  .superRefine((input, ctx) => {
    if (
      money.safeParse(input.amountEur).success &&
      toUnits(input.amountEur, 2) <= BigInt(0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["amountEur"],
        message: "Entry total must be positive.",
      });
    if (
      !PARTICIPANT_TRANSPORT_EMISSION_PROFILES.some(
        (profile) => profile === input.transportProfile,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["transportProfile"],
        message: "Choose a currently configured transport profile.",
      });
    const seen = new Set<string>();
    let total = BigInt(0);
    input.allocations.forEach((allocation, index) => {
      if (seen.has(allocation.projectParticipantId))
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index, "projectParticipantId"],
          message: "Participation occurs more than once.",
        });
      seen.add(allocation.projectParticipantId);
      const share =
        input.allocationMethod === "percentage"
          ? allocation.percentage
          : allocation.amountEur;
      if (
        input.allocationMethod === "equal"
          ? allocation.percentage !== undefined ||
            allocation.amountEur !== undefined
          : !share ||
            (input.allocationMethod === "percentage"
              ? allocation.amountEur !== undefined
              : allocation.percentage !== undefined)
      )
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index],
          message: `Allocation must use only ${input.allocationMethod} shares.`,
        });
      if (
        share &&
        (input.allocationMethod === "percentage" ? percentage : money).safeParse(
          share,
        ).success &&
        toUnits(share, input.allocationMethod === "percentage" ? 6 : 2) <=
          BigInt(0)
      )
        ctx.addIssue({
          code: "custom",
          path: ["allocations", index],
          message: "Allocation share must be positive.",
        });
      if (
        share &&
        (input.allocationMethod === "percentage" ? percentage : money).safeParse(
          share,
        ).success
      )
        total += toUnits(share, input.allocationMethod === "percentage" ? 6 : 2);
    });
    if (input.allocationMethod !== "equal") {
      const expected =
        input.allocationMethod === "percentage"
          ? BigInt(100000000)
          : money.safeParse(input.amountEur).success
            ? toUnits(input.amountEur, 2)
            : BigInt(0);
      if (total !== expected)
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: `${input.allocationMethod} shares must total ${input.allocationMethod === "percentage" ? "100%" : `${input.amountEur} EUR`}; received ${input.allocationMethod === "percentage" ? `${total} millionths of a percent` : `${fromCents(total)} EUR`}.`,
        });
    }
  });

const allocationOutput = z.object({
  projectParticipantId: z.string(),
  percentage: z.string().nullable(),
  amountEur: z.string().nullable(),
});
const entryOutput = z.object({
  id: z.string(),
  transportProfile: z.string(),
  amountEur: z.string(),
  allocationMethod: z.enum(["equal", "percentage", "amount"]),
  allocations: z.array(allocationOutput),
  proofDocumentIds: z.array(z.string()),
});
const selectedEntry = {
  id: entries.id,
  transportProfile: entries.transportProfile,
  amountEur: entries.amountEur,
  allocationMethod: entries.allocationMethod,
};

type Errors = Parameters<typeof requirePartnerCoordination>[3] & {
  BAD_REQUEST: (options: { message: string }) => Error;
};
async function requirePartnerSide(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Errors,
) {
  const scope = await requirePartnerCoordination(
    partnershipId,
    actorId,
    activeOrganizationId,
    errors,
  );
  if (scope.partnerId !== activeOrganizationId)
    throw createSituationErrors(errors).partnerCostsRequired();
  return scope;
}

/** Equal shares are derived in cents; stable Participation-ID order receives any remainder. */
async function readEntries(claimId: string) {
  const rows = await db
    .select(selectedEntry)
    .from(entries)
    .where(eq(entries.claimId, claimId));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [shares, evidence] = await Promise.all([
    db
      .select()
      .from(allocations)
      .where(inArray(allocations.travelCostEntryId, ids)),
    db.select().from(links).where(inArray(links.travelCostEntryId, ids)),
  ]);
  return rows.map((row) => {
    const covered = shares
      .filter((share) => share.travelCostEntryId === row.id)
      .sort((a, b) =>
        a.projectParticipantId.localeCompare(b.projectParticipantId),
      );
    const cents = toUnits(row.amountEur, 2);
    const count = BigInt(covered.length);
    return {
      ...row,
      allocations: covered.map((share, index) => ({
        projectParticipantId: share.projectParticipantId,
        percentage: share.percentage,
        amountEur:
          row.allocationMethod === "equal" && count > BigInt(0)
            ? fromCents(
                cents / count +
                  (BigInt(index) < cents % count ? BigInt(1) : BigInt(0)),
              )
            : share.amountEur,
      })),
      proofDocumentIds: evidence
        .filter((link) => link.travelCostEntryId === row.id)
        .map((link) => link.proofDocumentId)
        .sort(),
    };
  });
}

export const list = authorized
  .input(scopeInput)
  .output(
    z.object({
      entries: z.array(entryOutput),
      coveredProjectParticipantIds: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const [claim] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.partnershipId, input.partnershipId))
      .limit(1);
    const claimEntries = claim ? await readEntries(claim.id) : [];
    return {
      entries: claimEntries,
      coveredProjectParticipantIds: [
        ...new Set(
          claimEntries.flatMap((entry) =>
            entry.allocations.map((share) => share.projectParticipantId),
          ),
        ),
      ].sort(),
    };
  });

/** The Claim must exist already; allocation replacement is atomic under its row lock. */
export const save = authorized
  .input(saveInput)
  .output(entryOutput)
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    const id = await db.transaction(async (tx) => {
      // Shared lock order: Claim-owned cost data is guarded by the Claim state.
      const { claim } = await lockClaimScope(
        tx,
        { projectId: scope.projectId, partnershipId: input.partnershipId },
        errors,
        "claim",
      );
      if (!claim) throw createSituationErrors(errors).claimRequiredForCosts();
      if (isPartnerEditLocked(claim.status))
        throw createSituationErrors(errors).claimNotEditable();
      const valid = await tx
        .select({ id: participants.id })
        .from(participants)
        .where(
          and(
            inArray(
              participants.id,
              input.allocations.map(
                (allocation) => allocation.projectParticipantId,
              ),
            ),
            eq(participants.projectId, scope.projectId),
            eq(participants.representedOrganizationId, scope.partnerId),
            isNull(participants.mergedIntoParticipantId),
          ),
        );
      if (valid.length !== input.allocations.length)
        throw createSituationErrors(errors).allocationParticipationRequired();
      if (input.entryId) {
        const [existing] = await tx
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(eq(entries.id, input.entryId), eq(entries.claimId, claim.id)),
          )
          .limit(1);
        if (!existing) throw createSituationErrors(errors).costEntryRequired();
        await tx
          .update(entries)
          .set({
            transportProfile:
              input.transportProfile as typeof entries.$inferInsert.transportProfile,
            amountEur: input.amountEur,
            allocationMethod: input.allocationMethod,
          })
          .where(eq(entries.id, existing.id));
        await tx
          .delete(allocations)
          .where(eq(allocations.travelCostEntryId, existing.id));
      }
      const entryId =
        input.entryId ??
        (
          await tx
            .insert(entries)
            .values({
              claimId: claim.id,
              transportProfile:
                input.transportProfile as typeof entries.$inferInsert.transportProfile,
              amountEur: input.amountEur,
              allocationMethod: input.allocationMethod,
            })
            .returning({ id: entries.id })
        )[0].id;
      await tx.insert(allocations).values(
        input.allocations.map((allocation) => ({
          travelCostEntryId: entryId,
          projectParticipantId: allocation.projectParticipantId,
          percentage: allocation.percentage ?? null,
          amountEur: allocation.amountEur ?? null,
        })),
      );
      return entryId;
    });
    const [entry] = (
      await readEntries(
        (
          await db
            .select({ id: claims.id })
            .from(claims)
            .where(eq(claims.partnershipId, input.partnershipId))
            .limit(1)
        )[0].id,
      )
    ).filter((row) => row.id === id);
    return entry;
  });

export const linkDocument = authorized
  .input(
    scopeInput.extend({
      entryId: coordinationId,
      proofDocumentId: coordinationId,
    }),
  )
  .output(z.object({ linked: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerSide(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    return db.transaction(async (tx) => {
      // Shared lock order: the association belongs to the Claim it revalidates.
      const { claim } = await lockClaimScope(
        tx,
        { projectId: scope.projectId, partnershipId: input.partnershipId },
        errors,
        "claim",
      );
      if (!claim) throw createSituationErrors(errors).claimRequiredForCosts();
      if (isPartnerEditLocked(claim.status))
        throw createSituationErrors(errors).claimNotEditable();
      const [entry] = await tx
        .select({ id: entries.id })
        .from(entries)
        .where(and(eq(entries.id, input.entryId), eq(entries.claimId, claim.id)))
        .limit(1);
      const [document] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.id, input.proofDocumentId),
            eq(documents.claimId, claim.id),
          ),
        )
        .limit(1);
      if (!entry || !document)
        throw createSituationErrors(errors).claimDocumentReferencesRequired();
      await tx
        .insert(links)
        .values({ travelCostEntryId: entry.id, proofDocumentId: document.id })
        .onConflictDoNothing();
      return { linked: true as const };
    });
  });
