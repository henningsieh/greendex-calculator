import "server-only";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  participantJourneysTable as journeys,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  proofDocumentsTable as documents,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as links,
} from "@greendex/database/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { isPartnerEditLocked } from "@/features/projects/procedures/claim-locks";
import {
  coordinationId,
  requirePartnerCoordination,
} from "@/features/projects/procedures/coordination";
import {
  decimalUnits,
  derivePayable,
} from "@/features/projects/procedures/payable";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

const issue = (path: string[], message: string) => ({ path, message });
const exact = (value: string | null, scale: number) => {
  if (value === null) return null;
  try {
    return decimalUnits(value, scale);
  } catch {
    return null;
  }
};

type SubmissionTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const checklistKeys = [
  "payoutAccount",
  "entries",
  "entryDetails",
  "proofDocuments",
  "participations",
  "journeys",
  "fundingRules",
] as const;

function checklistItems(issues: ReturnType<typeof issue>[]) {
  const groups: Record<
    (typeof checklistKeys)[number],
    ReturnType<typeof issue>[]
  > = {
    payoutAccount: [],
    entries: [],
    entryDetails: [],
    proofDocuments: [],
    participations: [],
    journeys: [],
    fundingRules: [],
  };
  for (const gap of issues) {
    const [root, , detail] = gap.path;
    const key =
      root === "payoutAccount"
        ? "payoutAccount"
        : root === "fundingRules" || detail === "fundingBand"
          ? "fundingRules"
          : root === "participations"
            ? detail === "journey"
              ? "journeys"
              : "participations"
            : root === "entries"
              ? gap.path.length === 1
                ? "entries"
                : detail === "proofDocuments"
                  ? "proofDocuments"
                  : "entryDetails"
              : "fundingRules";
    groups[key].push(gap);
    if (
      root === "participations" &&
      detail === "journey" &&
      gap.path.length === 3
    )
      groups.participations.push(gap);
  }
  // The final check is the conjunction of all validation rules, not just funding-band errors.
  if (issues.length && !groups.fundingRules.length)
    groups.fundingRules.push(issues[0]);
  // No entries means dependent checks cannot pass even without individual rows to inspect.
  if (groups.entries.length) {
    for (const key of checklistKeys.slice(2)) {
      if (!groups[key].length)
        groups[key].push(
          issue(
            ["entries"],
            "Add a Travel Cost Entry to check this requirement.",
          ),
        );
    }
  }
  return checklistKeys.map((key) => ({
    key,
    passed: !groups[key].length,
    gaps: groups[key],
  }));
}

// Shared read-only evaluation: the preview and locked submit use identical validations.
async function evaluateSubmission(
  tx: SubmissionTx,
  claimId: string | null,
  partnershipId: string,
  scope: { projectId: string; partnerId: string },
) {
  const issues: ReturnType<typeof issue>[] = [];
  const [selection] = await tx
    .select({ id: accounts.id })
    .from(selections)
    .innerJoin(
      accounts,
      and(
        eq(accounts.id, selections.payoutAccountId),
        eq(accounts.organizationId, scope.partnerId),
      ),
    )
    .where(eq(selections.partnershipId, partnershipId))
    .limit(1);
  if (!selection)
    issues.push(issue(["payoutAccount"], "Select a Partner Payout Account."));
  const costRows = claimId
    ? await tx.select().from(entries).where(eq(entries.claimId, claimId))
    : [];
  if (!costRows.length)
    issues.push(issue(["entries"], "Add at least one Travel Cost Entry."));
  const entryIds = costRows.map((row) => row.id);
  const shares = entryIds.length
    ? await tx
        .select()
        .from(allocations)
        .where(inArray(allocations.travelCostEntryId, entryIds))
    : [];
  const evidence =
    entryIds.length && claimId
      ? await tx
          .select({ entryId: links.travelCostEntryId })
          .from(links)
          .innerJoin(
            documents,
            and(
              eq(documents.id, links.proofDocumentId),
              eq(documents.claimId, claimId),
            ),
          )
          .where(inArray(links.travelCostEntryId, entryIds))
      : [];
  const snapshot = await tx
    .select()
    .from(snapshots)
    .where(eq(snapshots.projectId, scope.projectId))
    .limit(1);
  const fundingBands = await tx
    .select()
    .from(bands)
    .where(eq(bands.projectId, scope.projectId));
  const frozen = snapshot[0];
  const covered = new Set(shares.map((share) => share.projectParticipantId));
  const people = covered.size
    ? await tx
        .select()
        .from(participants)
        .where(inArray(participants.id, [...covered]))
    : [];
  const routes = covered.size
    ? await tx
        .select()
        .from(journeys)
        .where(inArray(journeys.projectParticipantId, [...covered]))
    : [];
  const eligible = new Set(
    people
      .filter(
        (person) =>
          person.projectId === scope.projectId &&
          person.representedOrganizationId === scope.partnerId &&
          !person.mergedIntoParticipantId,
      )
      .map((person) => person.id),
  );
  const validRoutes: { participantId: string; distanceKm: string }[] = [];
  for (const participantId of covered) {
    if (!eligible.has(participantId))
      issues.push(
        issue(
          ["participations", participantId],
          "Covered Participation must belong to this Project Partnership.",
        ),
      );
    const route = routes.find(
      (row) => row.projectParticipantId === participantId,
    );
    if (!route) {
      issues.push(
        issue(
          ["participations", participantId, "journey"],
          "Add a Participant Journey.",
        ),
      );
      continue;
    }
    if (!route.origin.trim())
      issues.push(
        issue(
          ["participations", participantId, "journey", "origin"],
          "Enter a Journey origin.",
        ),
      );
    if (!route.destination.trim())
      issues.push(
        issue(
          ["participations", participantId, "journey", "destination"],
          "Enter a Journey destination.",
        ),
      );
    if (!["one-way", "round-trip"].includes(route.tripType))
      issues.push(
        issue(
          ["participations", participantId, "journey", "tripType"],
          "Select a Journey trip type.",
        ),
      );
    const distance = exact(route.erasmusDistanceKm, 2);
    if (distance === null || distance <= BigInt(0))
      issues.push(
        issue(
          ["participations", participantId, "journey", "erasmusDistanceKm"],
          "Enter a positive exact Erasmus distance.",
        ),
      );
    if (distance !== null && distance > BigInt(0)) {
      validRoutes.push({
        participantId,
        distanceKm: route.erasmusDistanceKm,
      });
      if (
        fundingBands.filter(
          (band) =>
            distance >= decimalUnits(band.minKm, 2) &&
            distance <= decimalUnits(band.maxKm, 2),
        ).length !== 1
      )
        issues.push(
          issue(
            ["participations", participantId, "fundingBand"],
            "Journey distance must have exactly one frozen funding band.",
          ),
        );
    }
  }
  if (!frozen || !fundingBands.length)
    issues.push(
      issue(
        ["fundingRules"],
        "Project has no complete frozen funding rules; save a Participant Journey first.",
      ),
    );
  for (const entry of costRows) {
    const path = ["entries", entry.id];
    if (!frozen?.participantTransportProfiles.includes(entry.transportProfile))
      issues.push(
        issue(
          [...path, "transportProfile"],
          `Transport choice ${entry.transportProfile} is not in this Project's frozen rules; replace the entry.`,
        ),
      );
    const amount = exact(entry.amountEur, 2);
    if (amount === null || amount <= BigInt(0))
      issues.push(
        issue([...path, "amountEur"], "Entry amount must be positive exact EUR."),
      );
    const allocated = shares.filter((row) => row.travelCostEntryId === entry.id);
    if (!allocated.length)
      issues.push(
        issue(
          [...path, "allocations"],
          "Allocate this entry to at least one Participation.",
        ),
      );
    else {
      const invalid = allocated.some((row) =>
        entry.allocationMethod === "equal"
          ? row.percentage !== null || row.amountEur !== null
          : entry.allocationMethod === "percentage"
            ? row.amountEur !== null ||
              (exact(row.percentage, 6) ?? BigInt(0)) <= BigInt(0)
            : row.percentage !== null ||
              (exact(row.amountEur, 2) ?? BigInt(0)) <= BigInt(0),
      );
      const sum = allocated.reduce(
        (total, row) =>
          total +
          (exact(
            entry.allocationMethod === "percentage"
              ? row.percentage
              : row.amountEur,
            entry.allocationMethod === "percentage" ? 6 : 2,
          ) ?? BigInt(0)),
        BigInt(0),
      );
      if (
        invalid ||
        (entry.allocationMethod === "equal" &&
          amount !== null &&
          amount < BigInt(allocated.length)) ||
        (entry.allocationMethod === "percentage" && sum !== BigInt(100000000)) ||
        (entry.allocationMethod === "amount" && sum !== amount)
      )
        issues.push(
          issue(
            [...path, "allocations"],
            "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
          ),
        );
    }
    if (!evidence.some((row) => row.entryId === entry.id))
      issues.push(
        issue(
          [...path, "proofDocuments"],
          "Link a Proof Document belonging to this Claim.",
        ),
      );
  }
  const approvedAmountEur = issues.length
    ? null
    : derivePayable(
        costRows.map((row) => ({
          amountEur: row.amountEur,
          transportProfile: row.transportProfile,
          participantIds: shares
            .filter((share) => share.travelCostEntryId === row.id)
            .map((share) => share.projectParticipantId),
        })),
        validRoutes,
        fundingBands,
      );
  return { issues, approvedAmountEur };
}

export const previewSubmission = authorized
  .input(z.object({ partnershipId: coordinationId }))
  .output(
    z
      .object({
        items: z.array(
          z.object({
            key: z.enum(checklistKeys),
            passed: z.boolean(),
            gaps: z.array(
              z.object({ path: z.array(z.string()), message: z.string() }),
            ),
          }),
        ),
        calculatedPayableEur: z.string().nullable(),
      })
      .nullable(),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    if (scope.partnerId !== context.session.activeOrganizationId)
      throw createSituationErrors(errors).partnerClaimPreviewRequired();
    return db.transaction(async (tx) => {
      const [claim] = await tx
        .select({ id: claims.id, status: claims.status })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .limit(1);
      if (claim && isPartnerEditLocked(claim.status)) return null;
      const { issues, approvedAmountEur } = await evaluateSubmission(
        tx,
        claim?.id ?? null,
        input.partnershipId,
        scope,
      );
      return {
        items: checklistItems(issues),
        calculatedPayableEur: approvedAmountEur,
      };
    });
  });

/** Project first, then Partnership, then Claim: journey creation and payout selection share this ordering. */
export const submit = authorized
  .input(z.object({ partnershipId: coordinationId }))
  .output(
    z.object({
      id: z.string(),
      status: z.literal("submitted"),
      approvedAmountEur: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const scope = await requirePartnerCoordination(
      input.partnershipId,
      context.user.id,
      context.session.activeOrganizationId,
      errors,
    );
    if (scope.partnerId !== context.session.activeOrganizationId)
      throw createSituationErrors(errors).partnerClaimSubmitRequired();
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
            eq(partnerships.organizationId, scope.partnerId),
            eq(partnerships.projectId, scope.projectId),
          ),
        )
        .for("update")
        .limit(1);
      if (!project || !partnership)
        throw createSituationErrors(errors).partnershipNotFound();
      const [claim] = await tx
        .select({ id: claims.id, status: claims.status })
        .from(claims)
        .where(eq(claims.partnershipId, input.partnershipId))
        .for("update")
        .limit(1);
      if (claim?.status === "submitted") {
        const [latest] = await tx
          .select({ eventType: history.eventType })
          .from(history)
          .where(eq(history.claimId, claim.id))
          .orderBy(desc(history.occurredAt), desc(history.id))
          .limit(1);
        if (latest && ["submitted", "resubmitted"].includes(latest.eventType)) {
          const [saved] = await tx
            .select({ approvedAmountEur: claims.approvedAmountEur })
            .from(claims)
            .where(eq(claims.id, claim.id))
            .limit(1);
          if (saved.approvedAmountEur === null) {
            console.error("Submitted Claim history lacks a saved payable amount");
            throw createSituationErrors(errors).internalFailure();
          }
          return {
            id: claim.id,
            status: "submitted" as const,
            approvedAmountEur: saved.approvedAmountEur,
          };
        }
      }
      if (!claim)
        throw createSituationErrors(errors).claimRequiredForSubmission();
      if (isPartnerEditLocked(claim.status))
        throw createSituationErrors(errors).claimNotEditable();

      const { issues, approvedAmountEur } = await evaluateSubmission(
        tx,
        claim.id,
        input.partnershipId,
        scope,
      );
      if (issues.length)
        throw createSituationErrors(errors).submissionIncomplete(issues);
      if (approvedAmountEur === null) {
        console.error("Complete Claim checklist has no payable amount");
        throw createSituationErrors(errors).internalFailure();
      }
      await tx
        .update(claims)
        .set({ status: "submitted", approvedAmountEur })
        .where(eq(claims.id, claim.id));
      await tx.insert(history).values({
        claimId: claim.id,
        actorUserId: context.user.id,
        eventType:
          claim.status === "correction_requested" ? "resubmitted" : "submitted",
      });
      return { id: claim.id, status: "submitted" as const, approvedAmountEur };
    });
  });
