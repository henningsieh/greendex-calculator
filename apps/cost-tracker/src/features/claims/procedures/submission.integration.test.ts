// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  partnershipPayoutAccountsTable as selections,
  participantJourneysTable as journeys,
  projectFundingSnapshotsTable as snapshots,
  proofDocumentsTable as documents,
  travelCostEntriesTable as entries,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerSubmission.
const suffix = "canonical";
const id = (part: string) => `submit-${part}-${suffix}`;
const host = id("host"),
  partner = id("partner"),
  other = id("other");
const actor = id("actor"),
  participantUser = id("participant-user");
let project: string, own: string, foreign: string;
let robin: string, sam: string, outsider: string, third: string, proof: string;
const account = id("account"),
  alternate = id("alternate");
const scenarioNames = [
  "editable",
  "submitted",
  "rejected",
  "approved",
  "paid",
  "correction",
] as const;
type SubmissionScenario = (typeof scenarioNames)[number];
const baselines = new Map<
  SubmissionScenario,
  {
    claim: typeof claims.$inferSelect;
    doc: typeof documents.$inferSelect;
    selection: typeof selections.$inferSelect;
  }
>();
const touchedScenarios = new Set<SubmissionScenario>();
function useScenario(name: SubmissionScenario) {
  touchedScenarios.add(name);
  const scenarioId = (part: string) => id(`${name}-${part}`);
  project = scenarioId("project");
  own = scenarioId("own");
  foreign = scenarioId("foreign");
  robin = scenarioId("robin");
  sam = scenarioId("sam");
  outsider = scenarioId("outsider");
  third = scenarioId("third");
  proof = scenarioId("proof");
  claimId = scenarioId("claim");
}
async function restoreScenario(name: SubmissionScenario) {
  const baseline = baselines.get(name);
  if (!baseline) throw new Error("Canonical Submission baseline missing.");
  const scenarioId = (part: string) => id(`${name}-${part}`);
  // Exact baseline restoration removes procedure outputs and deliberate corruptions.
  await db.delete(history).where(eq(history.claimId, baseline.claim.id));
  await db.delete(claims).where(eq(claims.id, baseline.claim.id));
  await db.insert(claims).values(baseline.claim);
  await db.insert(documents).values(baseline.doc);
  await db
    .delete(selections)
    .where(eq(selections.partnershipId, baseline.selection.partnershipId));
  await db.insert(selections).values(baseline.selection);
  for (const part of ["robin", "sam", "third"])
    await db
      .delete(journeys)
      .where(eq(journeys.projectParticipantId, scenarioId(part)));
  await db
    .delete(snapshots)
    .where(eq(snapshots.projectId, scenarioId("project")));
  if (name === "correction") {
    const event = baselineCorrectionEvent;
    if (event) await db.insert(history).values(event);
  }
}
let baselineCorrectionEvent: typeof history.$inferSelect | undefined;
let claimId: string;
let activeOrg = partner;
let activeActor = actor;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const submit = () => client.claims.submit({ partnershipId: own });

beforeAll(async () => {
  baselineCorrectionEvent = await db.query.claimHistoryTable.findFirst({
    where: eq(history.id, id("correction-submitted-event")),
  });
  for (const name of scenarioNames) {
    useScenario(name);
    const claim = await db.query.claimsTable.findFirst({
      where: eq(claims.partnershipId, own),
    });
    const doc = await db.query.proofDocumentsTable.findFirst({
      where: eq(documents.id, proof),
    });
    const selection = await db.query.partnershipPayoutAccountsTable.findFirst({
      where: eq(selections.partnershipId, own),
    });
    if (!claim || !doc || !selection)
      throw new Error("Canonical Submission seed required.");
    baselines.set(name, { claim, doc, selection });
  }
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: activeActor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(() => {
  touchedScenarios.clear();
  activeOrg = partner;
  activeActor = actor;
  useScenario("editable");
});
afterEach(async () => {
  for (const name of touchedScenarios) await restoreScenario(name);
});

async function prepare(amountEur = "1000.01") {
  await client.journeys.save({
    partnershipId: own,
    projectParticipantId: robin,
    origin: "Berlin",
    destination: "Riga",
    tripType: "round-trip",
    erasmusDistanceKm: "850.25",
  });
  await client.journeys.save({
    partnershipId: own,
    projectParticipantId: sam,
    origin: "Paris",
    destination: "Riga",
    tripType: "one-way",
    erasmusDistanceKm: "1030.00",
  });
  const train = await client.costs.save({
    partnershipId: own,
    transportProfile: "train",
    amountEur,
    allocationMethod: "equal",
    allocations: [{ projectParticipantId: robin }, { projectParticipantId: sam }],
  });
  const plane = await client.costs.save({
    partnershipId: own,
    transportProfile: "plane",
    amountEur: "1.00",
    allocationMethod: "amount",
    allocations: [{ projectParticipantId: sam, amountEur: "1.00" }],
  });
  await client.costs.linkDocument({
    partnershipId: own,
    entryId: train.id,
    proofDocumentId: proof,
  });
  await client.costs.linkDocument({
    partnershipId: own,
    entryId: plane.id,
    proofDocumentId: proof,
  });
  return { train, plane };
}

// The role × procedure matrix is documented in apps/cost-tracker/docs/claim-authorization-matrix.md.
// Each generated case has a role and procedure in its test name for auditability.
const claimProcedures = [
  "claims.getDraft",
  "claims.saveDraft",
  "claims.selectPayoutAccount",
  "claims.submit",
  "claims.getHistory",
  "claims.requestCorrection",
  "claims.approve",
  "claims.reject",
  "claims.reopen",
  "claims.markPaid",
  "claims.correctPayment",
  "costs.list",
  "costs.save",
  "costs.linkDocument",
  "journeys.list",
  "journeys.save",
  "journeys.update",
] as const;
type ClaimProcedure = (typeof claimProcedures)[number];
const partnerProcedures: readonly ClaimProcedure[] = [
  "claims.getDraft",
  "claims.saveDraft",
  "claims.selectPayoutAccount",
  "claims.submit",
  "claims.getHistory",
  "costs.list",
  "costs.save",
  "costs.linkDocument",
  "journeys.list",
  "journeys.save",
  "journeys.update",
];
const hostProcedures: readonly ClaimProcedure[] = [
  "claims.getDraft",
  "claims.getHistory",
  "claims.requestCorrection",
  "claims.approve",
  "claims.reject",
  "claims.reopen",
  "claims.markPaid",
  "claims.correctPayment",
];
const roles = [
  {
    name: "Partner assigned coordinator",
    side: "partner",
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: true,
  },
  {
    name: "Partner owner",
    side: "partner",
    role: ORGANIZATION_ROLES.OrganizationOwner,
    assigned: false,
  },
  {
    name: "Partner admin",
    side: "partner",
    role: ORGANIZATION_ROLES.OrganizationAdmin,
    assigned: false,
  },
  {
    name: "Partner unassigned coordinator",
    side: "partner",
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: false,
  },
  {
    name: "Partner unassigned participant",
    side: "partner",
    role: ORGANIZATION_ROLES.Participant,
    assigned: false,
  },
  {
    name: "Partner participant",
    side: "partner",
    role: ORGANIZATION_ROLES.Participant,
    assigned: true,
  },
  {
    name: "Hosting assigned coordinator",
    side: "host",
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: true,
  },
  {
    name: "Hosting owner",
    side: "host",
    role: ORGANIZATION_ROLES.OrganizationOwner,
    assigned: false,
  },
  {
    name: "Hosting admin",
    side: "host",
    role: ORGANIZATION_ROLES.OrganizationAdmin,
    assigned: false,
  },
  {
    name: "Hosting unassigned coordinator",
    side: "host",
    role: ORGANIZATION_ROLES.ProjectCoordinator,
    assigned: false,
  },
  {
    name: "Hosting unassigned participant",
    side: "host",
    role: ORGANIZATION_ROLES.Participant,
    assigned: false,
  },
  {
    name: "Hosting participant",
    side: "host",
    role: ORGANIZATION_ROLES.Participant,
    assigned: true,
  },
] as const;

async function invokeMatrixProcedure(procedure: ClaimProcedure, entryId: string) {
  const input = { partnershipId: own };
  switch (procedure) {
    case "claims.getDraft":
      return client.claims.getDraft(input);
    case "claims.saveDraft":
      return client.claims.saveDraft(input);
    case "claims.selectPayoutAccount":
      return client.claims.selectPayoutAccount({
        ...input,
        payoutAccountId: alternate,
      });
    case "claims.submit":
      return client.claims.submit(input);
    case "claims.getHistory":
      return client.claims.getHistory(input);
    case "claims.requestCorrection":
      return client.claims.requestCorrection({
        ...input,
        reason: "Fix evidence",
      });
    case "claims.approve":
      return client.claims.approve(input);
    case "claims.reject":
      return client.claims.reject({ ...input, reason: "Ineligible" });
    case "claims.reopen":
      return client.claims.reopen(input);
    case "claims.markPaid":
      return client.claims.markPaid({ ...input, amountEur: "100.00" });
    case "claims.correctPayment":
      return client.claims.correctPayment({ ...input, reason: "No transfer" });
    case "costs.list":
      return client.costs.list(input);
    case "costs.save":
      return client.costs.save({
        ...input,
        transportProfile: "train",
        amountEur: "10.00",
        allocationMethod: "equal",
        allocations: [{ projectParticipantId: robin }],
      });
    case "costs.linkDocument":
      return client.costs.linkDocument({
        ...input,
        entryId,
        proofDocumentId: proof,
      });
    case "journeys.list":
      return client.journeys.list(input);
    case "journeys.save":
      return client.journeys.save({
        ...input,
        projectParticipantId: third,
        origin: "Berlin",
        destination: "Riga",
        tripType: "one-way",
        erasmusDistanceKm: "850",
      });
    case "journeys.update":
      return client.journeys.update({
        ...input,
        projectParticipantId: robin,
        origin: "Tallinn",
        destination: "Riga",
        tripType: "one-way",
        erasmusDistanceKm: "850",
      });
  }
}

function isMatrixRoleAllowed(role: (typeof roles)[number]) {
  return (
    (role.role === ORGANIZATION_ROLES.ProjectCoordinator && role.assigned) ||
    role.role === ORGANIZATION_ROLES.OrganizationOwner ||
    role.role === ORGANIZATION_ROLES.OrganizationAdmin
  );
}

describe("Claim authorization matrix", () => {
  it.each(
    roles.flatMap((role) =>
      claimProcedures.map((procedure) => ({ role, procedure })),
    ),
  )("$role.name × $procedure", async ({ role, procedure }) => {
    const allowed = isMatrixRoleAllowed(role);
    const expected =
      allowed &&
      (role.side === "host" ? hostProcedures : partnerProcedures).includes(
        procedure,
      );
    const statuses: Partial<Record<ClaimProcedure, SubmissionScenario>> = {
      "claims.requestCorrection": "submitted",
      "claims.approve": "submitted",
      "claims.reject": "submitted",
      "claims.reopen": "rejected",
      "claims.markPaid": "approved",
      "claims.correctPayment": "paid",
    };
    useScenario(statuses[procedure] ?? "editable");
    let entryId = "missing-entry";
    if (expected && procedure === "claims.submit") await prepare("100.00");
    if (procedure === "journeys.update") {
      await client.journeys.save({
        partnershipId: own,
        projectParticipantId: robin,
        origin: "Berlin",
        destination: "Riga",
        tripType: "one-way",
        erasmusDistanceKm: "850",
      });
      if (expected)
        await client.journeys.save({
          partnershipId: own,
          projectParticipantId: sam,
          origin: "Paris",
          destination: "Riga",
          tripType: "one-way",
          erasmusDistanceKm: "1030",
        });
    }
    if (expected && procedure === "costs.linkDocument") {
      entryId = (
        await client.costs.save({
          partnershipId: own,
          transportProfile: "train",
          amountEur: "10.00",
          allocationMethod: "equal",
          allocations: [{ projectParticipantId: robin }],
        })
      ).id;
    }
    const orgId = role.side === "host" ? host : partner;
    const person = id(
      `matrix-${role.side}-${role.role}-${role.assigned ? "assigned" : "unassigned"}`,
    );
    activeOrg = orgId;
    activeActor = person;
    try {
      if (expected)
        expect(await invokeMatrixProcedure(procedure, entryId)).toBeDefined();
      else
        await expect(
          invokeMatrixProcedure(procedure, entryId),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      activeOrg = partner;
      activeActor = actor;
    }
  });
});

describe("Claim submission", () => {
  it("concurrent double-submit writes one submission history event", async () => {
    await prepare();
    const [first, retry] = await Promise.all([submit(), submit()]);
    expect(retry).toEqual(first);
    expect(
      (
        await db.select().from(history).where(eq(history.claimId, claimId))
      ).filter((row) => row.eventType === "submitted"),
    ).toHaveLength(1);
  });

  it("re-derives the payable from the frozen band after a Partner journey correction and resubmission", async () => {
    await prepare();
    const first = await submit();
    expect(first.approvedAmountEur).toBe("726.00");
    const correctionInput = {
      partnershipId: own,
      projectParticipantId: robin,
      origin: "Berlin",
      destination: "Riga",
      tripType: "round-trip" as const,
      erasmusDistanceKm: "2500",
    };
    await expect(client.journeys.update(correctionInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await asHost();
    await review("requestCorrection", "Correct distance");
    activeOrg = partner;
    const originalClaim = (
      await db.select().from(claims).where(eq(claims.id, claimId))
    )[0];
    const frozen = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, project));
    const corrected = await client.journeys.update(correctionInput);
    expect(corrected.erasmusDistanceKm).toBe("2500.00");
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0],
    ).toEqual(originalClaim);
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual(frozen);
    expect(await client.claims.getHistory({ partnershipId: own })).toMatchObject([
      { eventType: "submitted" },
      { eventType: "correction_requested", reason: "Correct distance" },
      {
        eventType: "journey_updated",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
    ]);
    const second = await submit();
    expect(second).toMatchObject({
      id: first.id,
      status: "submitted",
      approvedAmountEur: "844.00",
    });
    await expect(client.journeys.update(correctionInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect((await events()).map((row) => row.eventType)).toEqual([
      "submitted",
      "correction_requested",
      "journey_updated",
      "resubmitted",
    ]);
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("concurrent resubmission retries write one resubmitted event", async () => {
    await prepare();
    await submit();
    await asHost();
    await review("requestCorrection");
    activeOrg = partner;
    const [first, retry] = await Promise.all([submit(), submit()]);
    expect(retry).toEqual(first);
    expect(
      (await events()).filter((event) => event.eventType === "resubmitted"),
    ).toHaveLength(1);
  });

  it("previews seven blocked items before a Claim exists without creating one", async () => {
    await db.delete(claims).where(eq(claims.id, claimId));
    const preview = await client.claims.previewSubmission({ partnershipId: own });
    expect(preview?.items).toHaveLength(7);
    expect(
      preview?.items.find((item) => item.key === "payoutAccount")?.passed,
    ).toBe(true);
    expect(preview?.items.find((item) => item.key === "entries")?.passed).toBe(
      false,
    );
    expect(preview?.items.every((item) => item.passed)).toBe(false);
    expect(await client.claims.getDraft({ partnershipId: own })).toBeNull();
    expect(
      await db.select().from(history).where(eq(history.claimId, claimId)),
    ).toEqual([]);
  });

  it("restricts submission preview to the partner and hides it after submission", async () => {
    await prepare();
    activeOrg = host;
    await expect(
      client.claims.previewSubmission({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = partner;
    await submit();
    expect(
      await client.claims.previewSubmission({ partnershipId: own }),
    ).toBeNull();
  });

  it("previews missing checklist gaps without writing claim state or history", async () => {
    await db.delete(selections).where(eq(selections.partnershipId, own));
    const before = await db.select().from(claims).where(eq(claims.id, claimId));
    const preview = await client.claims.previewSubmission({ partnershipId: own });
    if (!preview) throw new Error("Expected editable Claim preview");
    expect(preview.items).toHaveLength(7);
    expect(preview.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "payoutAccount",
          passed: false,
          gaps: expect.arrayContaining([
            expect.objectContaining({ path: ["payoutAccount"] }),
          ]),
        }),
        expect.objectContaining({
          key: "entries",
          passed: false,
          gaps: expect.arrayContaining([
            expect.objectContaining({ path: ["entries"] }),
          ]),
        }),
      ]),
    );
    expect(preview.calculatedPayableEur).toBeNull();
    expect(await db.select().from(claims).where(eq(claims.id, claimId))).toEqual(
      before,
    );
    expect(
      await db.select().from(history).where(eq(history.claimId, claimId)),
    ).toEqual([]);
  });

  it("marks missing covered Journey in both participation and journey checklist items", async () => {
    await prepare();
    await db.delete(journeys).where(eq(journeys.projectParticipantId, robin));
    const preview = await client.claims.previewSubmission({ partnershipId: own });
    expect(
      preview?.items.find((item) => item.key === "participations"),
    ).toMatchObject({
      passed: false,
      gaps: expect.arrayContaining([
        expect.objectContaining({ path: ["participations", robin, "journey"] }),
      ]),
    });
    expect(preview?.items.find((item) => item.key === "journeys")?.passed).toBe(
      false,
    );
    expect(preview?.calculatedPayableEur).toBeNull();
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("previews the same calculated payable as submission without writing", async () => {
    await prepare();
    const before = await db.select().from(claims).where(eq(claims.id, claimId));
    const preview = await client.claims.previewSubmission({ partnershipId: own });
    if (!preview) throw new Error("Expected editable Claim preview");
    expect(preview.items).toHaveLength(7);
    expect(preview.items.every((item) => item.passed)).toBe(true);
    expect(preview.calculatedPayableEur).toBe("726.00");
    expect(await db.select().from(claims).where(eq(claims.id, claimId))).toEqual(
      before,
    );
    expect(
      await db.select().from(history).where(eq(history.claimId, claimId)),
    ).toEqual([]);
    expect((await submit()).approvedAmountEur).toBe(preview.calculatedPayableEur);
  });

  it("itemizes missing checklist items and never partially submits", async () => {
    await db.delete(selections).where(eq(selections.partnershipId, own));
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["payoutAccount"] }),
          expect.objectContaining({ path: ["entries"] }),
        ]),
      },
    });
    expect(
      (await db.select().from(claims).where(eq(claims.partnershipId, own)))[0]
        .status,
    ).toBe("editable");
    // Scoped to this Claim: the shared dev database may hold unrelated history.
    expect(
      await db.select().from(history).where(eq(history.claimId, claimId)),
    ).toEqual([]);
  });

  it("derives a capped payable from snapshot and locks all Partner writes with a history event", async () => {
    await prepare();
    const profiles =
      PARTICIPANT_TRANSPORT_EMISSION_PROFILES as unknown as string[];
    const configBands = TRAVEL_FUNDING_RULES.bands as unknown as {
      greenEur: number;
    }[];
    const original = configBands[2].greenEur;
    const index = profiles.indexOf("train");
    profiles.splice(index, 1);
    configBands[2].greenEur = 999;
    try {
      expect(await submit()).toMatchObject({
        status: "submitted",
        approvedAmountEur: "726.00",
      });
    } finally {
      profiles.splice(index, 0, "train");
      configBands[2].greenEur = original;
    }
    expect(
      await db.select().from(history).where(eq(history.claimId, claimId)),
    ).toMatchObject([
      {
        eventType: "submitted",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
    ]);
    expect(await submit()).toMatchObject({
      status: "submitted",
      approvedAmountEur: "726.00",
    });
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.costs.save({
        partnershipId: own,
        transportProfile: "train",
        amountEur: "1.00",
        allocationMethod: "equal",
        allocations: [{ projectParticipantId: robin }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.save({
        partnershipId: own,
        projectParticipantId: third,
        origin: "X",
        destination: "Y",
        tripType: "one-way",
        erasmusDistanceKm: "800",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 15_000);

  it("reports invalid frozen transport, missing evidence, journeys and relationship separately", async () => {
    const { train } = await prepare("100.00");
    await db.delete(journeys).where(eq(journeys.projectParticipantId, sam));
    // Deliberate invalid persisted state is under test; exact baseline/output cleanup runs afterEach.
    await db
      .update(snapshots)
      .set({ participantTransportProfiles: ["plane"] })
      .where(eq(snapshots.projectId, project));
    await db.delete(documents).where(eq(documents.id, proof));
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: ["entries", train.id, "transportProfile"],
          }),
          expect.objectContaining({
            path: ["entries", train.id, "proofDocuments"],
          }),
          expect.objectContaining({ path: ["participations", sam, "journey"] }),
        ]),
      },
    });
  });

  it("rejects Hosting, Participant and other Partnership submission", async () => {
    await expect(
      client.claims.submit({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(submit()).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = partner;
    activeActor = participantUser;
    await expect(submit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("itemizes missing allocations, journey fields and funding-band errors", async () => {
    const { train } = await prepare("100.00");
    await db
      .delete(allocations)
      .where(eq(allocations.travelCostEntryId, train.id));
    // Deliberate invalid persisted state is under test; exact baseline/output cleanup runs afterEach.
    await db
      .update(journeys)
      .set({ origin: "", destination: "", erasmusDistanceKm: "4000.00" })
      .where(eq(journeys.projectParticipantId, sam));
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["entries", train.id, "allocations"] }),
          expect.objectContaining({
            path: ["participations", sam, "journey", "origin"],
          }),
          expect.objectContaining({
            path: ["participations", sam, "journey", "destination"],
          }),
          expect.objectContaining({
            path: ["participations", sam, "fundingBand"],
          }),
        ]),
      },
    });
  });

  it("reports invalid allocation totals and cross-Partnership participation without a transition", async () => {
    const { train } = await prepare("100.00");
    // Deliberate invalid persisted state is under test; exact baseline/output cleanup runs afterEach.
    await db
      .update(allocations)
      .set({ projectParticipantId: outsider })
      .where(
        and(
          eq(allocations.travelCostEntryId, train.id),
          eq(allocations.projectParticipantId, robin),
        ),
      );
    // Deliberate invalid persisted state is under test; exact baseline/output cleanup runs afterEach.
    await db
      .update(entries)
      .set({ allocationMethod: "amount" })
      .where(eq(entries.id, train.id));
    // Deliberate invalid persisted state is under test; exact baseline/output cleanup runs afterEach.
    await db
      .update(allocations)
      .set({ amountEur: "1.00" })
      .where(eq(allocations.travelCostEntryId, train.id));
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["participations", outsider] }),
          expect.objectContaining({ path: ["entries", train.id, "allocations"] }),
        ]),
      },
    });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("editable");
  });

  it("pays exact costs below cap and reopens all Partner edits on correction requested", async () => {
    await prepare("100.01");
    expect(await submit()).toMatchObject({ approvedAmountEur: "101.01" });
    useScenario("correction");
    await prepare("100.01");
    expect(await client.claims.saveDraft({ partnershipId: own })).toMatchObject({
      status: "correction_requested",
    });
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: alternate,
    });
    const correction = await client.costs.save({
      partnershipId: own,
      transportProfile: "train",
      amountEur: "1.00",
      allocationMethod: "equal",
      allocations: [{ projectParticipantId: robin }],
    });
    await client.costs.linkDocument({
      partnershipId: own,
      entryId: correction.id,
      proofDocumentId: proof,
    });
    expect(await submit()).toMatchObject({
      status: "submitted",
      approvedAmountEur: "102.01",
    });
    expect((await events()).map((event) => event.eventType)).toEqual([
      "submitted",
      "resubmitted",
    ]);
  });

  it("serializes payout selection against submission without half-locked selection", async () => {
    await prepare("100.00");
    const results = await Promise.allSettled([
      submit(),
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ]);
    const selected = (
      await db.select().from(selections).where(eq(selections.partnershipId, own))
    )[0].payoutAccountId;
    expect(results[0].status).toBe("fulfilled");
    expect([account, alternate]).toContain(selected);
    expect(
      (await db.select().from(claims).where(eq(claims.partnershipId, own)))[0]
        .status,
    ).toBe("submitted");
    if (results[1].status === "rejected") expect(selected).toBe(account);
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

const review = (
  action: "requestCorrection" | "approve" | "reject" | "reopen",
  reason?: string,
) =>
  action === "requestCorrection" || action === "reject"
    ? client.claims[action]({ partnershipId: own, reason: reason ?? "Reason" })
    : client.claims[action]({ partnershipId: own });

async function asHost(
  role: string = ORGANIZATION_ROLES.ProjectCoordinator,
  userId = actor,
) {
  activeOrg = host;
  activeActor =
    role === ORGANIZATION_ROLES.ProjectCoordinator && userId === actor
      ? actor
      : id(`matrix-host-${role}-${userId === actor ? "assigned" : "unassigned"}`);
}

async function submittedClaim() {
  await prepare("100.01");
  await submit();
  await asHost();
}

describe("Claim lock abuse", () => {
  it("does not hide a submitted retry's missing saved payable amount as an edit lock", async () => {
    await submittedClaim();
    // Deliberate missing payable corruption is under test, restored by afterEach.
    await db
      .update(claims)
      .set({ approvedAmountEur: null })
      .where(eq(claims.id, claimId));
    const before = await events();
    activeOrg = partner;
    await expect(submit()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { reason: "INTERNAL_FAILURE" },
    });
    expect(await events()).toEqual(before);
  });

  it.each(["submitted", "approved", "rejected", "paid"] as const)(
    "%s blocks every Partner edit without changing Claim data or history",
    async (status) => {
      const { train } = await prepare("100.00");
      await submit();
      if (status !== "submitted") {
        await asHost();
        if (status === "rejected") await review("reject");
        else {
          const approved = await review("approve");
          if (status === "paid")
            await client.claims.markPaid({
              partnershipId: own,
              amountEur: approved.approvedAmountEur!,
            });
        }
        activeOrg = partner;
      }
      const before = {
        claim: await db.select().from(claims).where(eq(claims.id, claimId)),
        selection: await db
          .select()
          .from(selections)
          .where(eq(selections.partnershipId, own)),
        costs: await db
          .select()
          .from(entries)
          .where(eq(entries.claimId, claimId)),
        history: await db
          .select()
          .from(history)
          .where(eq(history.claimId, claimId)),
        journey: await db
          .select()
          .from(journeys)
          .where(eq(journeys.projectParticipantId, third)),
      };
      const attempts = [
        () => client.claims.saveDraft({ partnershipId: own }),
        () =>
          client.claims.selectPayoutAccount({
            partnershipId: own,
            payoutAccountId: alternate,
          }),
        () =>
          client.costs.save({
            partnershipId: own,
            entryId: train.id,
            transportProfile: "train",
            amountEur: "9.00",
            allocationMethod: "equal",
            allocations: [{ projectParticipantId: robin }],
          }),
        () =>
          client.costs.linkDocument({
            partnershipId: own,
            entryId: train.id,
            proofDocumentId: proof,
          }),
        () =>
          client.journeys.save({
            partnershipId: own,
            projectParticipantId: third,
            origin: "X",
            destination: "Y",
            tripType: "one-way",
            erasmusDistanceKm: "800",
          }),
      ];
      for (const attempt of attempts)
        await expect(attempt()).rejects.toMatchObject({
          code: "BAD_REQUEST",
          message: expect.stringMatching(/locked|editable/i),
        });
      expect(
        await db.select().from(claims).where(eq(claims.id, claimId)),
      ).toEqual(before.claim);
      expect(
        await db
          .select()
          .from(selections)
          .where(eq(selections.partnershipId, own)),
      ).toEqual(before.selection);
      expect(
        await db.select().from(entries).where(eq(entries.claimId, claimId)),
      ).toEqual(before.costs);
      expect(
        await db.select().from(history).where(eq(history.claimId, claimId)),
      ).toEqual(before.history);
      expect(
        await db
          .select()
          .from(journeys)
          .where(eq(journeys.projectParticipantId, third)),
      ).toEqual(before.journey);
    },
  );
});

describe("Host Claim review", () => {
  it("reads submitted Claim cost, proof, payout and journey details for assigned Hosting reviewer only", async () => {
    await prepare();
    await submit();
    activeOrg = host;
    const details = await client.claims.getReviewDetails({ partnershipId: own });
    expect(details.approvedAmountEur).toBe("726.00");
    expect(details.payoutAccount).toMatchObject({ iban: expect.any(String) });
    expect(details.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allocations: expect.arrayContaining([
            expect.objectContaining({ participantName: expect.any(String) }),
          ]),
          documents: expect.arrayContaining([
            expect.objectContaining({ originalFileName: "proof.pdf" }),
          ]),
        }),
      ]),
    );
    expect(details.journeys.length).toBeGreaterThan(0);
    activeOrg = partner;
    await expect(
      client.claims.getReviewDetails({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = host;
    activeActor = participantUser;
    await expect(
      client.claims.getReviewDetails({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeActor = actor;
  });
  it.each([
    ["approve", "approved", "approved"],
    ["reject", "rejected", "rejected"],
    ["requestCorrection", "correction_requested", "correction_requested"],
  ] as const)(
    "retry %s records one %s decision",
    async (action, status, event) => {
      await submittedClaim();
      const [first, retry] = await Promise.all([review(action), review(action)]);
      expect(first.status).toBe(status);
      expect(retry).toEqual(first);
      expect(
        (
          await db.select().from(history).where(eq(history.claimId, claimId))
        ).filter((row) => row.eventType === event),
      ).toHaveLength(1);
    },
  );

  it("concurrent reopen retries retain one reopened event", async () => {
    await submittedClaim();
    await review("reject");
    const [first, retry] = await Promise.all([
      review("reopen"),
      review("reopen"),
    ]);
    expect(retry).toEqual(first);
    expect(
      (await events()).filter((event) => event.eventType === "reopened"),
    ).toHaveLength(1);
  });

  it("requires reasons, keeps rejected Claims readable and locked, and writes actor/time/history for every transition", async () => {
    await submittedClaim();
    await expect(
      client.claims.requestCorrection({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(review("requestCorrection", "  ")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await review("requestCorrection", "  Fix proof  ")).toMatchObject({
      status: "correction_requested",
    });
    activeOrg = partner;
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: alternate,
    });
    const change = await client.costs.save({
      partnershipId: own,
      transportProfile: "train",
      amountEur: "1.00",
      allocationMethod: "equal",
      allocations: [{ projectParticipantId: robin }],
    });
    await client.costs.linkDocument({
      partnershipId: own,
      entryId: change.id,
      proofDocumentId: proof,
    });
    await submit();
    await asHost();
    await expect(
      client.claims.reject({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(review("reject", "   ")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await review("reject", "  Ineligible  ")).toMatchObject({
      status: "rejected",
    });
    activeOrg = partner;
    expect(await client.claims.getDraft({ partnershipId: own })).toMatchObject({
      status: "rejected",
    });
    expect(await client.claims.getHistory({ partnershipId: own })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "rejected",
          reason: "Ineligible",
          actorUserId: actor,
          occurredAt: expect.any(Date),
        }),
      ]),
    );
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(submit()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await asHost();
    expect(await review("reopen")).toMatchObject({ status: "submitted" });
    expect(
      (await events()).map(({ eventType, reason, actorUserId, occurredAt }) => ({
        eventType,
        reason,
        actorUserId,
        occurredAt,
      })),
    ).toMatchObject([
      {
        eventType: "submitted",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
      {
        eventType: "correction_requested",
        reason: "Fix proof",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
      {
        eventType: "resubmitted",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
      {
        eventType: "rejected",
        reason: "Ineligible",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
      { eventType: "reopened", actorUserId: actor, occurredAt: expect.any(Date) },
    ]);
    activeOrg = partner;
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(submit()).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 15_000);

  it("names a missing scoped Claim instead of a review/payment state, while submit retains save-first400", async () => {
    await db.delete(claims).where(eq(claims.id, claimId));
    await asHost();
    for (const action of [
      "approve",
      "getReviewDetails",
      "markPaid",
      "correctPayment",
    ] as const) {
      await expect(
        client.claims[action]({
          partnershipId: own,
          amountEur: "101.01",
          reason: "Correction",
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Claim not found in scope.",
        data: { reason: "CLAIM_NOT_FOUND" },
      });
    }
    expect(await events()).toEqual([]);
    activeOrg = partner;
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "CLAIM_REQUIRED_FOR_SUBMISSION" },
    });
  });

  it("cannot approve incomplete or unsubmitted Claims, confirms submitted payable and permanently locks Partner editing", async () => {
    await asHost();
    await expect(review("approve")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "CLAIM_SUBMITTED_REQUIRED" },
    });
    activeOrg = partner;
    await prepare("100.01");
    await asHost();
    await expect(review("approve")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    // Deliberate saved-payable corruption is under test; restored before the supported submission below.
    await db
      .update(claims)
      .set({ status: "submitted", approvedAmountEur: null })
      .where(eq(claims.id, claimId));
    await expect(review("approve")).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { reason: "INTERNAL_FAILURE" },
    });
    await db
      .update(claims)
      .set({ status: "editable" })
      .where(eq(claims.id, claimId));
    activeOrg = partner;
    const submitted = await submit();
    await asHost();
    expect(await review("approve")).toMatchObject({
      status: "approved",
      approvedAmountEur: submitted.approvedAmountEur,
    });
    await expect(review("requestCorrection")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(review("reopen")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    activeOrg = partner;
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.costs.save({
        partnershipId: own,
        transportProfile: "train",
        amountEur: "1.00",
        allocationMethod: "equal",
        allocations: [{ projectParticipantId: robin }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.save({
        partnershipId: own,
        projectParticipantId: third,
        origin: "X",
        destination: "Y",
        tripType: "one-way",
        erasmusDistanceKm: "800",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await events()).map((event) => event.eventType)).toEqual([
      "submitted",
      "approved",
    ]);
  }, 15_000);

  it("denies reopen while paid and all transitions outside their source state", async () => {
    await submittedClaim();
    await expect(review("reopen")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await review("reject");
    useScenario("paid");
    await expect(review("reopen")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("paid");
  }, 15_000);

  it("enforces the Hosting role matrix on every review action and every Partnership", async () => {
    await submittedClaim();
    const actions = ["requestCorrection", "approve", "reject", "reopen"] as const;
    for (const role of [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ]) {
      await asHost(role);
      for (const action of actions) {
        const name = action === "reopen" ? "rejected" : "submitted";
        await restoreScenario(name);
        useScenario(name);
        expect(await review(action)).toMatchObject({
          status:
            action === "requestCorrection"
              ? "correction_requested"
              : action === "reopen"
                ? "submitted"
                : action === "approve"
                  ? "approved"
                  : "rejected",
        });
      }
    }
    await asHost(ORGANIZATION_ROLES.Participant);
    for (const action of actions) {
      useScenario(action === "reopen" ? "rejected" : "submitted");
      await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const role of [
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ]) {
      await asHost(role, participantUser);
      for (const action of actions) {
        useScenario(action === "reopen" ? "rejected" : "submitted");
        await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    await asHost(ORGANIZATION_ROLES.Participant, participantUser);
    for (const action of actions) {
      useScenario(action === "reopen" ? "rejected" : "submitted");
      await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const org of [partner, other]) {
      activeOrg = org;
      activeActor = actor;
      for (const action of actions)
        await expect(review(action)).rejects.toMatchObject(
          org === other
            ? {
                code: "NOT_FOUND",
                message: "Project Partnership not found in scope.",
                data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
              }
            : {
                code: "FORBIDDEN",
                message: "Only Hosting staff may review Claims.",
              },
        );
      await expect(
        client.claims.getHistory({ partnershipId: foreign }),
      ).rejects.toMatchObject(
        org === other
          ? {
              code: "FORBIDDEN",
              message:
                "You need Partner Organization staff access or an assignment to this Project Partnership.",
              data: { reason: "PARTNER_COORDINATION_REQUIRED" },
            }
          : {
              code: "NOT_FOUND",
              message: "Project Partnership not found in scope.",
              data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
            },
      );
    }
    activeOrg = partner;
    activeActor = participantUser;
    for (const action of actions)
      await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.claims.getHistory({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await asHost(ORGANIZATION_ROLES.ProjectCoordinator);
    for (const action of actions)
      await expect(
        client.claims[action]({ partnershipId: foreign, reason: "Reason" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        data: { reason: "CLAIM_NOT_FOUND" },
      });
  }, 15_000);
});

const markPaid = (amountEur: string) =>
  client.claims.markPaid({ partnershipId: own, amountEur });
const correctPayment = (reason?: string) =>
  client.claims.correctPayment({ partnershipId: own, reason: reason ?? "" });
const events = () =>
  db
    .select()
    .from(history)
    .where(eq(history.claimId, claimId))
    .orderBy(asc(history.occurredAt));

async function approvedClaim() {
  await submittedClaim();
  const approved = await review("approve");
  return approved.approvedAmountEur!;
}

describe("Claim payment recording", () => {
  it("concurrent confirmed payment retries record one paid event", async () => {
    const payable = await approvedClaim();
    const [first, retry] = await Promise.all([
      markPaid(payable),
      markPaid(payable),
    ]);
    expect(retry).toEqual(first);
    expect(
      (await events()).filter((event) => event.eventType === "paid"),
    ).toHaveLength(1);
  });

  it("correction against a concurrent payment attempt cannot unlock or partially pay", async () => {
    const payable = await approvedClaim();
    const [payment, correction] = await Promise.allSettled([
      markPaid(payable),
      review("requestCorrection", "Change payout"),
    ]);
    expect(payment.status).toBe("fulfilled");
    expect(correction).toMatchObject({
      status: "rejected",
      reason: { code: "BAD_REQUEST" },
    });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("paid");
    expect((await events()).map((event) => event.eventType)).toEqual([
      "submitted",
      "approved",
      "paid",
    ]);
    activeOrg = partner;
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("payment attempt against a concurrent correction request fails without a paid event", async () => {
    await submittedClaim();
    const [payment, correction] = await Promise.allSettled([
      markPaid("101.01"),
      review("requestCorrection", "Correct evidence"),
    ]);
    expect(payment).toMatchObject({
      status: "rejected",
      reason: { code: "BAD_REQUEST" },
    });
    expect(correction.status).toBe("fulfilled");
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("correction_requested");
    expect((await events()).map((event) => event.eventType)).toEqual([
      "submitted",
      "correction_requested",
    ]);
  });

  it("rejects unpaid drafts, submissions and rejections without writing history", async () => {
    await asHost();
    await expect(markPaid("101.01")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Claim must be approved to record payment.",
      data: { reason: "CLAIM_APPROVAL_REQUIRED" },
    });
    expect(await events()).toEqual([]);
    activeOrg = partner;
    await submittedClaim();
    await expect(markPaid("101.01")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await review("reject", "Not eligible");
    const before = await events();
    await expect(markPaid("101.01")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("rejected");
    expect(await events()).toEqual(before);
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("rejects partial, excessive and invalid transfer amounts without changing an approved Claim", async () => {
    const payable = await approvedClaim();
    expect(payable).toBe("101.01");
    const before = await events();
    for (const amount of ["101.00", "101.02", "101.001", "0.00"]) {
      await expect(markPaid(amount)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("approved");
    expect(await events()).toEqual(before);
  });

  it("records one full confirmed transfer once, keeps approval separate, and locks payout selection", async () => {
    const payable = await approvedClaim();
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("approved");
    activeOrg = partner;
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await asHost();
    expect(await markPaid(payable)).toMatchObject({
      status: "paid",
      approvedAmountEur: payable,
    });
    expect(await markPaid(payable)).toMatchObject({ status: "paid" });
    await expect(markPaid("1.00")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await events()).map(({ eventType, actorUserId, occurredAt }) => ({
        eventType,
        actorUserId,
        occurredAt,
      })),
    ).toMatchObject([
      {
        eventType: "submitted",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
      { eventType: "approved", actorUserId: actor, occurredAt: expect.any(Date) },
      { eventType: "paid", actorUserId: actor, occurredAt: expect.any(Date) },
    ]);
    activeOrg = partner;
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("concurrent paid-flag correction retries retain one correction event", async () => {
    const payable = await approvedClaim();
    await markPaid(payable);
    const [first, retry] = await Promise.all([
      correctPayment("Transfer never sent"),
      correctPayment("Transfer never sent"),
    ]);
    expect(retry).toEqual(first);
    expect(
      (await events()).filter((event) => event.eventType === "payment_corrected"),
    ).toHaveLength(1);
  });

  it("corrects only a paid flag with a required reason, retaining both history events", async () => {
    const payable = await approvedClaim();
    await expect(correctPayment("Premature mark")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await markPaid(payable);
    const before = await events();
    await expect(correctPayment()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(correctPayment("  ")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await events()).toEqual(before);
    expect(await correctPayment("  Transfer never sent  ")).toMatchObject({
      status: "approved",
      approvedAmountEur: payable,
    });
    await expect(correctPayment("Again")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("approved");
    expect(await client.claims.getHistory({ partnershipId: own })).toMatchObject([
      { eventType: "submitted" },
      { eventType: "approved" },
      { eventType: "paid", actorUserId: actor, occurredAt: expect.any(Date) },
      {
        eventType: "payment_corrected",
        reason: "Transfer never sent",
        actorUserId: actor,
        occurredAt: expect.any(Date),
      },
    ]);
    activeOrg = partner;
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: alternate,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("limits payment actions to Hosting owners, admins and assigned coordinators", async () => {
    const payable = await approvedClaim();
    for (const role of [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.ProjectCoordinator,
    ]) {
      await asHost(role);
      await markPaid(payable);
      await correctPayment("Incorrect flag");
    }
    await asHost(ORGANIZATION_ROLES.Participant, participantUser);
    await expect(markPaid(payable)).rejects.toMatchObject({ code: "FORBIDDEN" });
    useScenario("paid");
    await expect(correctPayment("Incorrect flag")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    for (const org of [partner, other]) {
      activeOrg = org;
      activeActor = actor;
      await expect(markPaid(payable)).rejects.toMatchObject(
        org === other
          ? {
              code: "NOT_FOUND",
              message: "Project Partnership not found in scope.",
              data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
            }
          : {
              code: "FORBIDDEN",
              message: "Only Hosting staff may record payment.",
            },
      );
      await expect(correctPayment("Incorrect flag")).rejects.toMatchObject(
        org === other
          ? {
              code: "NOT_FOUND",
              message: "Project Partnership not found in scope.",
              data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
            }
          : {
              code: "FORBIDDEN",
              message: "Only Hosting staff may correct payment.",
            },
      );
    }
  });
});

describe("Claim competing writes", () => {
  it("a Partner cost edit racing submission cannot half-submit the Claim", async () => {
    await prepare("100.00");
    const [submission, saved] = await Promise.allSettled([
      submit(),
      client.costs.save({
        partnershipId: own,
        transportProfile: "train",
        amountEur: "5.00",
        allocationMethod: "equal",
        allocations: [{ projectParticipantId: robin }],
      }),
    ]);
    const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
    const submittedEvents = (await events()).filter((event) =>
      ["submitted", "resubmitted"].includes(event.eventType),
    );
    if (submission.status === "fulfilled") {
      // Submission won the Claim lock: the edit is safely refused, the Claim
      // holds exactly the prepared costs, and one submission event exists.
      expect(submission.value).toMatchObject({ status: "submitted" });
      expect(claim.status).toBe("submitted");
      expect(saved).toMatchObject({
        status: "rejected",
        reason: { code: "BAD_REQUEST" },
      });
      expect(submittedEvents).toHaveLength(1);
      expect(
        (await client.costs.list({ partnershipId: own })).entries,
      ).toHaveLength(2);
    } else {
      // The edit won: the new entry lacks Proof Documents, so submission is
      // refused as incomplete and the Claim stays editable with no event.
      expect(submission).toMatchObject({
        status: "rejected",
        reason: { code: "BAD_REQUEST" },
      });
      expect(saved.status).toBe("fulfilled");
      expect(claim.status).toBe("editable");
      expect(submittedEvents).toHaveLength(0);
      expect(
        (await client.costs.list({ partnershipId: own })).entries,
      ).toHaveLength(3);
    }
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("a Partner journey correction racing submission leaves one submitted Claim", async () => {
    await prepare("100.00");
    const [submission, corrected] = await Promise.allSettled([
      submit(),
      client.journeys.update({
        partnershipId: own,
        projectParticipantId: robin,
        origin: "Berlin Hbf",
        destination: "Riga",
        tripType: "round-trip",
        erasmusDistanceKm: "850.25",
      }),
    ]);
    // The correction keeps the checklist complete, so submission always
    // succeeds even when the correction wins the lock first.
    expect(submission).toMatchObject({
      status: "fulfilled",
      value: { status: "submitted" },
    });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("submitted");
    expect(
      (await events()).filter((event) =>
        ["submitted", "resubmitted"].includes(event.eventType),
      ),
    ).toHaveLength(1);
    if (corrected.status === "fulfilled") {
      expect(corrected.value).toMatchObject({ origin: "Berlin Hbf" });
    } else {
      // Submission won the Claim lock: the correction is safely refused.
      expect(corrected).toMatchObject({
        status: "rejected",
        reason: { code: "BAD_REQUEST" },
      });
    }
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("conflicting Hosting reviews leave exactly one decision", async () => {
    await submittedClaim();
    const [first, second] = await Promise.allSettled([
      review("approve"),
      review("reject"),
    ]);
    // Exactly one decision wins the Claim lock; the other finds the Claim
    // outside submitted and is safely refused.
    const loserRefusal = {
      status: "rejected",
      reason: {
        code: "BAD_REQUEST",
        data: { reason: "CLAIM_SUBMITTED_REQUIRED" },
      },
    };
    const winner = first.status === "fulfilled" ? first.value.status : "rejected";
    expect(first.status === "fulfilled" ? second : first).toMatchObject(
      loserRefusal,
    );
    expect(second.status === "fulfilled" ? first : second).toMatchObject(
      loserRefusal,
    );
    expect(winner).toMatch(/^(approved|rejected)$/);
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe(winner);
    expect(
      (await events()).filter((event) =>
        ["approved", "rejected"].includes(event.eventType),
      ),
    ).toHaveLength(1);
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);

  it("approval racing payment records at most one full transfer", async () => {
    await prepare("100.00");
    await submit();
    const [saved] = await db
      .select({ approvedAmountEur: claims.approvedAmountEur })
      .from(claims)
      .where(eq(claims.id, claimId));
    const payable = saved.approvedAmountEur!;
    await asHost();
    const [approval, payment] = await Promise.allSettled([
      review("approve"),
      markPaid(payable),
    ]);
    // Approval only commits from submitted, which payment cannot change, so
    // approval always succeeds while payment either waits for it or refuses.
    expect(approval).toMatchObject({
      status: "fulfilled",
      value: { status: "approved", approvedAmountEur: payable },
    });
    const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
    const types = (await events()).map((event) => event.eventType);
    if (payment.status === "fulfilled") {
      expect(payment.value).toMatchObject({
        status: "paid",
        approvedAmountEur: payable,
      });
      expect(claim.status).toBe("paid");
      // Approval and payment land in the same instant, so only the set
      // of events is stable here, not their timestamp order.
      expect([...types].sort()).toEqual(["approved", "paid", "submitted"]);
    } else {
      // Payment lost the race before approval: approval is required first.
      expect(payment).toMatchObject({
        status: "rejected",
        reason: {
          code: "BAD_REQUEST",
          data: { reason: "CLAIM_APPROVAL_REQUIRED" },
        },
      });
      expect(claim.status).toBe("approved");
      expect(types).toEqual(["submitted", "approved"]);
    }
    // No partial transfer is ever recorded: the amount always equals approval.
    expect(claim.approvedAmountEur).toBe(payable);
    // Remote-DB flow exceeded 5s under load; let it finish before fixture cleanup.
  }, 15_000);
});
