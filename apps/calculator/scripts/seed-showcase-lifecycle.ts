/* eslint-disable import/no-relative-parent-imports -- Seed drives the owning claim transition table and reimbursement derivation as the single source of truth (#453). */
/**
 * Procedure-driven Claim-status showcase seeding (#453).
 *
 * Every showcase Claim lifecycle state is produced by driving the owning claim
 * logic (create/submit/review/payment transitions) with the same validation
 * pipeline as the UI, not by hand-inserting amounts or history rows:
 * - The claim lifecycle transition table (`claimTransitions`) is the sole
 *   decider of allowed transitions; this driver exercises it, never bypasses.
 * - Amount math is single-sourced: `deriveReimbursement` over entries,
 *   journeys, and frozen funding bands. No Postgres triggers replicate it.
 * - History rows are written by the transition driver from the transition
 *   table's event names, with the real deciding actors (partner side submits,
 *   hosting side reviews/pays). No hand-written history.
 * - Permissions are evaluated against persisted memberships/assignments,
 *   mirroring `requirePartnerCoordination`: partner Owners/Admins or assigned
 *   coordinators act on the partner side; hosting Owners/Admins act on review.
 *
 * Why not the ORPC router caller here: the seed runs under plain `tsx`
 * (calculator or cost-tracker workspace) where `server-only`/`next/cache`
 * request context is unavailable, so importing the procedure routers throws.
 * The integration suites remain the router-caller seam; this driver reuses the
 * exact same transition table, derivation, and validation rules those suites
 * assert, and the tripwire below proves the result stayed consistent.
 *
 * Convergence: each slice is verified before writing. Consistent slices are
 * skipped (fast reruns, no rewrite of good data). Inconsistent slices —
 * including the pre-#453 impossible rows (e.g. paid €600 with zero entries)
 * — are rebuilt from the spec below. Showcase slices are demo data; the user
 * explicitly permits rebuilding them. All domain dates are fixed 2024
 * references; createdAt/metadata stays run-anchored.
 */

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  member,
  participantJourneysTable as journeys,
  partnerCoordinatorAssignmentsTable as assignments,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  proofDocumentsTable as documents,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectParticipantsTable as participants,
  projectsTable as projects,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as links,
} from "@greendex/database/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

import { evaluateClaimTransition } from "../../cost-tracker/src/features/claims/claim-lifecycle";
import { deriveReimbursement } from "../../cost-tracker/src/features/claims/reimbursement";
import type { SeedDatabase } from "./seed";
import { SEED_IDS } from "./seed-ids";
import {
  ensureSeedPartnerAssignments,
  ensureSeedPartnerships,
  ensureSeedProjects,
} from "./seed-tables";

type Db = SeedDatabase;

const PARTNER_ORIGIN: Record<string, string> = {
  inPreparation: "Vilnius",
  submitted: "Paris",
  correction: "Madrid",
  approved: "Rome",
  rejected: "Prague",
  paid: "Vienna",
  archived: "Lisbon",
};

interface ShowcaseSlice {
  key: keyof typeof PARTNER_ORIGIN;
  name: string;
  projectId: string;
  partnershipId: string;
  claimId: string;
  target: string;
  archived: boolean;
  participantNames: string[];
  distancesKm: string[];
  tripTypes: ("one-way" | "round-trip")[];
  entrySpecs: { transportProfile: string; amountEur: string }[];
  useSecondaryPayout: boolean;
  correctionReason?: string;
  rejectionReason?: string;
}

const SLICES: ShowcaseSlice[] = [
  {
    key: "inPreparation",
    name: "Seed Showcase In Preparation",
    projectId: SEED_IDS.project.showcaseInPreparation,
    partnershipId: SEED_IDS.partnership.showcaseInPreparation,
    claimId: SEED_IDS.claim.showcaseInPreparation,
    target: "in_preparation",
    archived: false,
    participantNames: ["Ava Showcase"],
    distancesKm: ["300.00"],
    tripTypes: ["one-way"],
    entrySpecs: [{ transportProfile: "train", amountEur: "120.00" }],
    useSecondaryPayout: false,
  },
  {
    key: "submitted",
    name: "Seed Showcase Submitted",
    projectId: SEED_IDS.project.showcaseSubmitted,
    partnershipId: SEED_IDS.partnership.showcaseSubmitted,
    claimId: SEED_IDS.claim.showcaseSubmitted,
    target: "submitted",
    archived: false,
    participantNames: ["Ben Showcase"],
    distancesKm: ["850.25"],
    tripTypes: ["round-trip"],
    entrySpecs: [{ transportProfile: "train", amountEur: "250.00" }],
    useSecondaryPayout: false,
  },
  {
    key: "correction",
    name: "Seed Showcase Correction Requested",
    projectId: SEED_IDS.project.showcaseCorrection,
    partnershipId: SEED_IDS.partnership.showcaseCorrection,
    claimId: SEED_IDS.claim.showcaseCorrection,
    target: "correction_requested",
    archived: false,
    participantNames: ["Cara Showcase"],
    distancesKm: ["850.25"],
    tripTypes: ["round-trip"],
    entrySpecs: [
      { transportProfile: "train", amountEur: "200.00" },
      { transportProfile: "bus", amountEur: "110.50" },
    ],
    useSecondaryPayout: true,
    correctionReason:
      "Seed showcase correction round-trip: please itemize the bus leg.",
  },
  {
    key: "approved",
    name: "Seed Showcase Approved",
    projectId: SEED_IDS.project.showcaseApproved,
    partnershipId: SEED_IDS.partnership.showcaseApproved,
    claimId: SEED_IDS.claim.showcaseApproved,
    target: "approved",
    archived: false,
    participantNames: ["Dan Showcase", "Eli Showcase"],
    distancesKm: ["850.25", "850.25"],
    tripTypes: ["round-trip", "round-trip"],
    entrySpecs: [{ transportProfile: "train", amountEur: "420.00" }],
    useSecondaryPayout: false,
  },
  {
    key: "rejected",
    name: "Seed Showcase Rejected",
    projectId: SEED_IDS.project.showcaseRejected,
    partnershipId: SEED_IDS.partnership.showcaseRejected,
    claimId: SEED_IDS.claim.showcaseRejected,
    target: "rejected",
    archived: false,
    participantNames: ["Fin Showcase"],
    distancesKm: ["300.00"],
    tripTypes: ["one-way"],
    entrySpecs: [{ transportProfile: "bus", amountEur: "175.25" }],
    useSecondaryPayout: false,
    rejectionReason: "Seed showcase: travel outside the eligible window.",
  },
  {
    key: "paid",
    name: "Seed Showcase Paid",
    projectId: SEED_IDS.project.showcasePaid,
    partnershipId: SEED_IDS.partnership.showcasePaid,
    claimId: SEED_IDS.claim.showcasePaid,
    target: "paid",
    archived: false,
    participantNames: ["Gus Showcase", "Hal Showcase"],
    distancesKm: ["850.25", "1200.00"],
    tripTypes: ["round-trip", "round-trip"],
    entrySpecs: [{ transportProfile: "train", amountEur: "500.00" }],
    useSecondaryPayout: false,
  },
  {
    key: "archived",
    name: "Seed Showcase Archived",
    projectId: SEED_IDS.project.showcaseArchived,
    partnershipId: SEED_IDS.partnership.showcaseArchived,
    claimId: SEED_IDS.claim.showcaseArchived,
    target: "paid",
    archived: true,
    participantNames: ["Ivy Showcase", "Jay Showcase"],
    distancesKm: ["2500.00", "850.25"],
    tripTypes: ["round-trip", "round-trip"],
    entrySpecs: [{ transportProfile: "train", amountEur: "600.00" }],
    useSecondaryPayout: false,
  },
];

const PRIMARY_IBAN = "DE75512108001245126199";
const SECONDARY_IBAN = "DE68210501700012345678";

const EVENT_DATES: Record<string, Date> = {
  submitted: new Date("2024-06-10T00:00:00Z"),
  correction_requested: new Date("2024-06-11T00:00:00Z"),
  resubmitted: new Date("2024-06-11T12:00:00Z"),
  approved: new Date("2024-06-12T00:00:00Z"),
  rejected: new Date("2024-06-12T00:00:00Z"),
  reopened: new Date("2024-06-13T00:00:00Z"),
  paid: new Date("2024-06-14T00:00:00Z"),
  payment_corrected: new Date("2024-06-15T00:00:00Z"),
};

function roleList(role: string): string[] {
  return role.split(",").map((part) => part.trim());
}

async function isPartnerSide(
  db: Db,
  partnershipId: string,
  actorId: string,
  partnerOrgId: string,
): Promise<void> {
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.userId, actorId), eq(member.organizationId, partnerOrgId)),
    )
    .limit(1);
  if (!membership)
    throw new Error(`Showcase seed: ${actorId} not in partner org`);
  const roles = roleList(membership.role);
  if (
    roles.includes(ORGANIZATION_ROLES.OrganizationOwner) ||
    roles.includes(ORGANIZATION_ROLES.OrganizationAdmin)
  )
    return;
  if (!roles.includes(ORGANIZATION_ROLES.ProjectCoordinator))
    throw new Error(`Showcase seed: ${actorId} lacks partner coordination role`);
  const [assignment] = await db
    .select({ userId: assignments.userId })
    .from(assignments)
    .where(
      and(
        eq(assignments.partnershipId, partnershipId),
        eq(assignments.userId, actorId),
      ),
    )
    .limit(1);
  if (!assignment)
    throw new Error(`Showcase seed: ${actorId} not assigned to partnership`);
}

async function isHostSide(
  db: Db,
  actorId: string,
  hostOrgId: string,
): Promise<void> {
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, actorId), eq(member.organizationId, hostOrgId)))
    .limit(1);
  if (!membership) throw new Error(`Showcase seed: ${actorId} not in host org`);
  const roles = roleList(membership.role);
  if (
    !roles.includes(ORGANIZATION_ROLES.OrganizationOwner) &&
    !roles.includes(ORGANIZATION_ROLES.OrganizationAdmin)
  )
    throw new Error(`Showcase seed: ${actorId} lacks hosting review role`);
}

async function ensurePayoutSelection(
  db: Db,
  partnershipId: string,
  partnerOrgId: string,
  useSecondary: boolean,
): Promise<void> {
  const iban = useSecondary ? SECONDARY_IBAN : PRIMARY_IBAN;
  let [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.organizationId, partnerOrgId), eq(accounts.iban, iban)),
    )
    .limit(1);
  if (!account) {
    const [created] = await db
      .insert(accounts)
      .values({
        organizationId: partnerOrgId,
        accountHolder: useSecondary
          ? "Seed Showcase Partner Secondary"
          : "Seed Showcase Partner",
        iban,
      })
      .returning({ id: accounts.id });
    account = created!;
  }
  const [existing] = await db
    .select()
    .from(selections)
    .where(eq(selections.partnershipId, partnershipId))
    .limit(1);
  if (!existing) {
    await db.insert(selections).values({
      partnershipId,
      payoutAccountId: account!.id,
    });
  }
}

async function ensureParticipants(
  db: Db,
  projectId: string,
  partnerOrgId: string,
  names: string[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const displayName of names) {
    const [existing] = await db
      .select({ id: participants.id })
      .from(participants)
      .where(
        and(
          eq(participants.projectId, projectId),
          eq(participants.displayName, displayName),
        ),
      )
      .limit(1);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const [created] = await db
      .insert(participants)
      .values({
        projectId,
        representedOrganizationId: partnerOrgId,
        displayName,
        country: "DE",
      })
      .returning({ id: participants.id });
    ids.push(created!.id);
  }
  return ids;
}

async function ensureSnapshotAndBands(db: Db, projectId: string): Promise<void> {
  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.projectId, projectId))
    .limit(1);
  if (!snapshot) {
    await db.insert(snapshots).values({
      projectId,
      rulesVersion: TRAVEL_FUNDING_RULES.version,
      participantTransportProfiles: [
        ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
      ],
    });
    await db.insert(bands).values(
      TRAVEL_FUNDING_RULES.bands.map((band) => ({
        projectId,
        minKm: String(band.minKm),
        maxKm: String(band.maxKm),
        standardEur: String(band.standardEur),
        greenEur: String(band.greenEur),
      })),
    );
  }
}

async function ensureJourneys(
  db: Db,
  participantIds: string[],
  slice: ShowcaseSlice,
): Promise<void> {
  for (const [index, participantId] of participantIds.entries()) {
    const [existing] = await db
      .select()
      .from(journeys)
      .where(eq(journeys.projectParticipantId, participantId))
      .limit(1);
    if (existing) continue;
    await db.insert(journeys).values({
      projectParticipantId: participantId,
      origin: PARTNER_ORIGIN[slice.key] ?? "Paris",
      destination: "Berlin",
      tripType: slice.tripTypes[index] ?? "round-trip",
      erasmusDistanceKm: slice.distancesKm[index] ?? "850.25",
    });
  }
}

async function writeHistory(
  db: Db,
  claimId: string,
  eventType: (typeof history.$inferSelect)["eventType"],
  actorUserId: string,
  reason?: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: history.id })
    .from(history)
    .where(and(eq(history.claimId, claimId), eq(history.eventType, eventType)))
    .limit(1);
  if (existing) return;
  await db.insert(history).values({
    claimId,
    eventType,
    actorUserId,
    occurredAt: EVENT_DATES[eventType] ?? new Date("2024-06-10T00:00:00Z"),
    reason: reason ?? null,
  });
}

interface SliceLedger {
  claimId: string;
  entryRows: { id: string; amountEur: string; transportProfile: string }[];
  shares: { travelCostEntryId: string; projectParticipantId: string }[];
  journeyRows: { participantId: string; distanceKm: string }[];
  bandRows: {
    minKm: string;
    maxKm: string;
    standardEur: string;
    greenEur: string;
  }[];
  profiles: string[];
}

async function loadLedger(
  db: Db,
  slice: ShowcaseSlice,
): Promise<{
  claim: typeof claims.$inferSelect | undefined;
  ledger: SliceLedger;
  historyEvents: string[];
}> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(eq(claims.id, slice.claimId))
    .limit(1);
  const entryRows = claim
    ? await db.select().from(entries).where(eq(entries.claimId, claim.id))
    : [];
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
    ? (
        await db
          .select()
          .from(journeys)
          .where(inArray(journeys.projectParticipantId, participantIds))
      ).map((row) => ({
        participantId: row.projectParticipantId,
        distanceKm: String(row.erasmusDistanceKm),
      }))
    : [];
  const bandRows = await db
    .select()
    .from(bands)
    .where(eq(bands.projectId, slice.projectId));
  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.projectId, slice.projectId))
    .limit(1);
  const historyRows = claim
    ? await db
        .select({ eventType: history.eventType })
        .from(history)
        .where(eq(history.claimId, claim.id))
        .orderBy(asc(history.occurredAt), asc(history.id))
    : [];
  return {
    claim,
    ledger: {
      claimId: slice.claimId,
      entryRows: entryRows.map((row) => ({
        id: row.id,
        amountEur: String(row.amountEur),
        transportProfile: String(row.transportProfile),
      })),
      shares: shares.map((share) => ({
        travelCostEntryId: share.travelCostEntryId,
        projectParticipantId: share.projectParticipantId,
      })),
      journeyRows,
      bandRows: bandRows.map((row) => ({
        minKm: String(row.minKm),
        maxKm: String(row.maxKm),
        standardEur: String(row.standardEur),
        greenEur: String(row.greenEur),
      })),
      profiles: (snapshot?.participantTransportProfiles as string[]) ?? [],
    },
    historyEvents: historyRows.map((row) => String(row.eventType)),
  };
}

/** Pure recomputation check shared by the driver and the tripwire. */
export function checkLedgerConsistency(
  status: string,
  storedAmount: string | null,
  ledger: SliceLedger,
): { expected: string | null; problem?: string } {
  if (ledger.entryRows.length === 0) {
    if (status === "in_preparation" && storedAmount === null)
      return { expected: null };
    return {
      expected: "0.00",
      problem: `amount without supporting entries is never legitimate (status ${status}, ${ledger.entryRows.length} entries)`,
    };
  }
  const derived = deriveReimbursement(
    ledger.entryRows.map((row) => ({
      amountEur: row.amountEur,
      transportProfile: row.transportProfile,
      participantIds: ledger.shares
        .filter((share) => share.travelCostEntryId === row.id)
        .map((share) => share.projectParticipantId),
    })),
    ledger.journeyRows,
    ledger.bandRows.map((row) => ({ ...row })),
  );
  if (status === "in_preparation") {
    if (storedAmount !== null)
      return {
        expected: derived,
        problem: "in_preparation must not carry an amount",
      };
    return { expected: null };
  }
  if (storedAmount !== derived)
    return {
      expected: derived,
      problem: "stored amount disagrees with recomputation",
    };
  return { expected: derived };
}

function historyCovers(status: string, events: string[]): boolean {
  const has = (event: string) => events.includes(event);
  switch (status) {
    case "in_preparation":
      return !events.some((event) =>
        ["submitted", "resubmitted", "approved", "rejected", "paid"].includes(
          event,
        ),
      );
    case "submitted":
      return has("submitted") || has("resubmitted");
    case "correction_requested":
      return (
        (has("submitted") || has("resubmitted")) && has("correction_requested")
      );
    case "approved":
      return (has("submitted") || has("resubmitted")) && has("approved");
    case "rejected":
      return (has("submitted") || has("resubmitted")) && has("rejected");
    case "paid":
      return (
        (has("submitted") || has("resubmitted")) && has("approved") && has("paid")
      );
    default:
      return false;
  }
}

async function sliceIsConsistent(db: Db, slice: ShowcaseSlice): Promise<boolean> {
  const { claim, ledger, historyEvents } = await loadLedger(db, slice);
  if (!claim || claim.status !== slice.target) return false;
  if (slice.archived) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, slice.projectId))
      .limit(1);
    if (!project?.costTrackerArchived) return false;
  }
  const stored =
    claim.reimbursementAmountEur === null
      ? null
      : String(claim.reimbursementAmountEur);
  // Showcase richness policy: every slice shows real workspace data, so even
  // the editable draft carries a journey, an entry and a proof document.
  // (An empty in_preparation draft is legitimate in general, just not here.)
  if (ledger.entryRows.length === 0 || ledger.journeyRows.length === 0)
    return false;
  const { problem } = checkLedgerConsistency(claim.status, stored, ledger);
  if (problem) return false;
  if (!historyCovers(claim.status, historyEvents)) return false;
  const [selection] = await db
    .select()
    .from(selections)
    .where(eq(selections.partnershipId, slice.partnershipId))
    .limit(1);
  if (claim.status !== "in_preparation" && !selection) return false;
  return true;
}

async function rebuildSlice(
  db: Db,
  slice: ShowcaseSlice,
  ids: {
    hostId: string;
    partnerId: string;
    ownerId: string;
    partnerOwnerId: string;
  },
): Promise<void> {
  const { claim } = await loadLedger(db, slice);
  if (claim) {
    await db.delete(history).where(eq(history.claimId, claim.id));
    const entryRows = await db
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.claimId, claim.id));
    const entryIds = entryRows.map((row) => row.id);
    if (entryIds.length) {
      await db.delete(links).where(inArray(links.travelCostEntryId, entryIds));
      await db
        .delete(allocations)
        .where(inArray(allocations.travelCostEntryId, entryIds));
      await db.delete(entries).where(inArray(entries.id, entryIds));
    }
    await db.delete(documents).where(eq(documents.claimId, claim.id));
    await db.delete(claims).where(eq(claims.id, claim.id));
  }
  const participantIds = await ensureParticipants(
    db,
    slice.projectId,
    ids.partnerId,
    slice.participantNames,
  );
  for (const participantId of participantIds) {
    await db
      .delete(journeys)
      .where(eq(journeys.projectParticipantId, participantId));
  }
  await ensureSnapshotAndBands(db, slice.projectId);
  await ensureJourneys(db, participantIds, slice);

  await isPartnerSide(db, slice.partnershipId, ids.partnerOwnerId, ids.partnerId);
  await isHostSide(db, ids.ownerId, ids.hostId);

  const create = evaluateClaimTransition(null, "create", { payoutAccount: true });
  if (create.kind === "refused")
    throw new Error(`Showcase seed: cannot create claim (${create.reason})`);
  const [created] = await db
    .insert(claims)
    .values({
      id: slice.claimId,
      partnershipId: slice.partnershipId,
      status: create.state,
    })
    .returning({ id: claims.id });
  const claimId = created!.id;

  const [doc] = await db
    .insert(documents)
    .values({
      claimId,
      fileReference: `seed/showcase/${slice.claimId}`,
      originalFileName: "ticket.pdf",
      mediaType: "application/pdf",
      byteSize: 4,
      checksum: "seed-checksum-showcase",
    })
    .returning({ id: documents.id });

  for (const spec of slice.entrySpecs) {
    const [entry] = await db
      .insert(entries)
      .values({
        claimId,
        transportProfile: spec.transportProfile as never,
        amountEur: spec.amountEur,
        allocationMethod: "equal",
      })
      .returning({ id: entries.id });
    await db.insert(allocations).values(
      participantIds.map((projectParticipantId) => ({
        travelCostEntryId: entry!.id,
        projectParticipantId,
        percentage: null,
        amountEur: null,
      })),
    );
    await db.insert(links).values({
      travelCostEntryId: entry!.id,
      proofDocumentId: doc!.id,
    });
  }

  if (slice.target === "in_preparation") return;

  const { ledger } = await loadLedger(db, slice);
  const submitReady =
    ledger.entryRows.length > 0 && ledger.journeyRows.length > 0;
  const submit = evaluateClaimTransition("in_preparation", "submit", {
    submissionReady: submitReady,
  });
  if (submit.kind === "refused")
    throw new Error(`Showcase seed: submit refused (${submit.reason})`);
  const derived = deriveReimbursement(
    ledger.entryRows.map((row) => ({
      amountEur: row.amountEur,
      transportProfile: row.transportProfile,
      participantIds: ledger.shares
        .filter((share) => share.travelCostEntryId === row.id)
        .map((share) => share.projectParticipantId),
    })),
    ledger.journeyRows,
    ledger.bandRows.map((row) => ({ ...row })),
  );
  await db
    .update(claims)
    .set({ status: submit.state, reimbursementAmountEur: derived })
    .where(eq(claims.id, claimId));
  await writeHistory(db, claimId, "submitted", ids.partnerOwnerId);

  if (slice.target === "submitted") return;

  if (slice.target === "correction_requested") {
    const correction = evaluateClaimTransition("submitted", "requestCorrection", {
      reason: true,
    });
    if (correction.kind === "refused")
      throw new Error(`Showcase seed: correction refused (${correction.reason})`);
    await db
      .update(claims)
      .set({ status: correction.state })
      .where(eq(claims.id, claimId));
    await writeHistory(
      db,
      claimId,
      "correction_requested",
      ids.ownerId,
      slice.correctionReason ?? "Seed showcase correction round-trip.",
    );
    return;
  }

  if (slice.target === "rejected") {
    const rejected = evaluateClaimTransition("submitted", "reject", {
      reason: true,
    });
    if (rejected.kind === "refused")
      throw new Error(`Showcase seed: reject refused (${rejected.reason})`);
    await db
      .update(claims)
      .set({ status: rejected.state })
      .where(eq(claims.id, claimId));
    await writeHistory(
      db,
      claimId,
      "rejected",
      ids.ownerId,
      slice.rejectionReason ?? "Seed showcase: ineligible travel dates.",
    );
    return;
  }

  const approved = evaluateClaimTransition("submitted", "approve", {});
  if (approved.kind === "refused")
    throw new Error(`Showcase seed: approve refused (${approved.reason})`);
  await db
    .update(claims)
    .set({ status: approved.state })
    .where(eq(claims.id, claimId));
  await writeHistory(db, claimId, "approved", ids.ownerId);

  if (slice.target === "approved") return;

  const [saved] = await db
    .select({ reimbursementAmountEur: claims.reimbursementAmountEur })
    .from(claims)
    .where(eq(claims.id, claimId))
    .limit(1);
  if (String(saved!.reimbursementAmountEur) !== derived)
    throw new Error(
      `Showcase seed: stored amount drifted before payment (${String(saved!.reimbursementAmountEur)} vs ${derived})`,
    );
  const paid = evaluateClaimTransition("approved", "markPaid", {
    fullPayment: true,
  });
  if (paid.kind === "refused")
    throw new Error(`Showcase seed: markPaid refused (${paid.reason})`);
  await db
    .update(claims)
    .set({ status: paid.state })
    .where(eq(claims.id, claimId));
  await writeHistory(db, claimId, "paid", ids.ownerId, undefined);
}

/**
 * Procedure-driven showcase entrypoint (replaces hand-inserted showcase).
 * Keeps project/partnership/assignment scaffolding on the shared find-or-create
 * helpers, then converges each Claim slice through the transition driver.
 */
export async function ensureClaimStatusShowcaseProcedural(
  db: Db,
  ids: {
    hostId: string;
    partnerId: string;
    ownerId: string;
    partnerOwnerId: string;
  },
): Promise<void> {
  {
    const rows = SLICES.map((slice) => ({
      id: slice.projectId,
      name: slice.name,
      organizationId: ids.hostId,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2024-06-07"),
      location: "Berlin",
      country: "DE" as const,
      archived: false,
      costTrackerArchived: slice.archived,
    }));
    await ensureSeedProjects(db, rows);
    for (const slice of SLICES) {
      if (!slice.archived) continue;
      await db
        .update(projects)
        .set({ costTrackerArchived: true })
        .where(eq(projects.id, slice.projectId));
    }
  }
  {
    const rows = SLICES.map((slice) => ({
      id: slice.partnershipId,
      projectId: slice.projectId,
      organizationId: ids.partnerId,
    }));
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = SLICES.map((slice) => ({
      partnershipId: slice.partnershipId,
      userId: ids.partnerOwnerId,
    }));
    await ensureSeedPartnerAssignments(db, rows);
  }
  for (const slice of SLICES) {
    await ensurePayoutSelection(
      db,
      slice.partnershipId,
      ids.partnerId,
      slice.useSecondaryPayout,
    );
  }
  for (const slice of SLICES) {
    if (await sliceIsConsistent(db, slice)) continue;
    await rebuildSlice(db, slice, ids);
    if (!(await sliceIsConsistent(db, slice)))
      throw new Error(
        `Showcase seed: slice ${slice.name} failed its own tripwire after rebuild`,
      );
  }
}

/**
 * End-of-seed consistency tripwire: recomputes every showcase Claim amount
 * with the real derivation and asserts history coverage per status. Fails the
 * seed with the offending Claim identity plus expected-versus-stored values.
 */
export async function verifyShowcaseTripwire(db: Db): Promise<void> {
  for (const slice of SLICES) {
    const { claim, ledger, historyEvents } = await loadLedger(db, slice);
    if (!claim)
      throw new Error(
        `Showcase tripwire: missing Claim ${slice.name} (${slice.claimId})`,
      );
    const stored =
      claim.reimbursementAmountEur === null
        ? null
        : String(claim.reimbursementAmountEur);
    const { expected, problem } = checkLedgerConsistency(
      claim.status,
      stored,
      ledger,
    );
    if (problem || expected !== stored) {
      throw new Error(
        `Showcase tripwire: Claim ${slice.name} (${slice.claimId}) status ${claim.status}: ` +
          `stored ${stored ?? "null"}, expected ${expected ?? "null"}` +
          (problem ? ` — ${problem}` : ""),
      );
    }
    if (claim.status !== slice.target) {
      throw new Error(
        `Showcase tripwire: Claim ${slice.name} (${slice.claimId}) status ${claim.status}, expected ${slice.target}`,
      );
    }
    // Showcase richness: every slice — including the editable draft — shows
    // real workspace data (entries, journeys, proof evidence).
    if (ledger.entryRows.length === 0 || ledger.journeyRows.length === 0) {
      throw new Error(
        `Showcase tripwire: Claim ${slice.name} (${slice.claimId}) status ${claim.status} ` +
          `has ${ledger.entryRows.length} entries and ${ledger.journeyRows.length} journeys; every showcase slice must show workspace data`,
      );
    }
    if (!historyCovers(claim.status, historyEvents)) {
      throw new Error(
        `Showcase tripwire: Claim ${slice.name} (${slice.claimId}) status ${claim.status} ` +
          `lacks required history (found: ${historyEvents.join(", ") || "none"})`,
      );
    }
  }
}
