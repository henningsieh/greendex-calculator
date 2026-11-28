// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Consume cross-app seed identities without loading the seed implementation. */

import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  participantJourneysTable as journeys,
  projectFundingBandsTable as bands,
  projectPartnerOrganizationsTable as partnerships,
  travelCostEntriesTable as entries,
} from "@greendex/database/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import { deriveReimbursement } from "@/features/claims/reimbursement";

const slices = [
  {
    name: "In Preparation",
    claimId: SEED_IDS.claim.showcaseInPreparation,
    status: "in_preparation",
    amount: null as string | null,
  },
  {
    name: "Submitted",
    claimId: SEED_IDS.claim.showcaseSubmitted,
    status: "submitted",
    amount: "250.00",
  },
  {
    name: "Correction",
    claimId: SEED_IDS.claim.showcaseCorrection,
    status: "correction_requested",
    amount: "310.50",
  },
  {
    name: "Approved",
    claimId: SEED_IDS.claim.showcaseApproved,
    status: "approved",
    amount: "420.00",
  },
  {
    name: "Rejected",
    claimId: SEED_IDS.claim.showcaseRejected,
    status: "rejected",
    amount: "175.25",
  },
  {
    name: "Paid",
    claimId: SEED_IDS.claim.showcasePaid,
    status: "paid",
    amount: "500.00",
  },
  {
    name: "Archived",
    claimId: SEED_IDS.claim.showcaseArchived,
    status: "paid",
    amount: "600.00",
  },
] as const;

async function recomputedAmount(claimId: string): Promise<string> {
  const entryRows = await db
    .select()
    .from(entries)
    .where(eq(entries.claimId, claimId));
  const entryIds = entryRows.map((row) => row.id);
  const shares = entryIds.length
    ? await db
        .select()
        .from(allocations)
        .where(inArray(allocations.travelCostEntryId, entryIds))
    : [];
  const participantIds = [
    ...new Set(shares.map((share) => share.projectParticipantId)),
  ];
  const journeyRows = participantIds.length
    ? await db
        .select()
        .from(journeys)
        .where(inArray(journeys.projectParticipantId, participantIds))
    : [];
  const [claim] = await db
    .select()
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);
  const [partnership] = await db
    .select({ projectId: partnerships.projectId })
    .from(partnerships)
    .where(eq(partnerships.id, claim!.partnershipId))
    .limit(1);
  const bandRows = await db
    .select()
    .from(bands)
    .where(eq(bands.projectId, partnership!.projectId));
  return deriveReimbursement(
    entryRows.map((row) => ({
      amountEur: String(row.amountEur),
      transportProfile: String(row.transportProfile),
      participantIds: shares
        .filter((share) => share.travelCostEntryId === row.id)
        .map((share) => share.projectParticipantId),
    })),
    journeyRows.map((row) => ({
      participantId: row.projectParticipantId,
      distanceKm: String(row.erasmusDistanceKm),
    })),
    bandRows.map((row) => ({
      minKm: String(row.minKm),
      maxKm: String(row.maxKm),
      standardEur: String(row.standardEur),
      greenEur: String(row.greenEur),
    })),
  );
}

describe("showcase seed consistency", () => {
  it("recomputes every showcase amount and asserts history coverage", async () => {
    for (const slice of slices) {
      const [claim] = await db
        .select()
        .from(claims)
        .where(eq(claims.id, slice.claimId))
        .limit(1);
      if (!claim)
        throw new Error(
          `Seed showcase Claim missing: ${slice.name} — run pnpm run db:seed.`,
        );
      expect(claim.status, slice.name).toBe(slice.status);
      const stored =
        claim.reimbursementAmountEur === null
          ? null
          : String(claim.reimbursementAmountEur);
      expect(stored, `${slice.name} amount`).toBe(slice.amount);
      if (slice.amount !== null) {
        // The stored figure must equal a fresh recomputation over entries,
        // journeys and frozen bands — never a hand-inserted fixture.
        expect(await recomputedAmount(claim.id), `${slice.name} recomputed`).toBe(
          slice.amount,
        );
      }

      const events = (
        await db
          .select({ eventType: history.eventType })
          .from(history)
          .where(eq(history.claimId, claim.id))
          .orderBy(asc(history.occurredAt), asc(history.id))
      ).map((row) => String(row.eventType));

      if (slice.status === "in_preparation") {
        expect(events).not.toContain("submitted");
      } else {
        expect(events, `${slice.name} history`).toContain("submitted");
      }
      if (slice.status === "correction_requested") {
        expect(events).toEqual(
          expect.arrayContaining(["submitted", "correction_requested"]),
        );
      }
      if (slice.status === "approved" || slice.status === "paid") {
        expect(events).toEqual(expect.arrayContaining(["submitted", "approved"]));
      }
      if (slice.status === "rejected") {
        expect(events).toEqual(expect.arrayContaining(["submitted", "rejected"]));
      }
      if (slice.status === "paid") {
        // Regression pin for the motivating specimen: a paid Claim carries the
        // full submitted → approved → paid chain, never zero entries.
        expect(events).toEqual(
          expect.arrayContaining(["submitted", "approved", "paid"]),
        );
        const entryRows = await db
          .select()
          .from(entries)
          .where(eq(entries.claimId, claim.id));
        expect(entryRows.length, `${slice.name} entries`).toBeGreaterThan(0);
      }
    }
  });
});
