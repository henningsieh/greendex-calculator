// @vitest-environment node
import { randomUUID } from "node:crypto";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  costAllocationsTable as allocations,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  participantJourneysTable as journeys,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  proofDocumentsTable as documents,
  travelCostEntriesTable as entries,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import {
  afterAll,
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

const suffix = randomUUID();
const id = (part: string) => `submit-${part}-${suffix}`;
const host = id("host"),
  partner = id("partner"),
  other = id("other");
const actor = id("actor"),
  participantUser = id("participant-user");
const project = id("project"),
  secondProject = id("second-project"),
  own = id("own"),
  foreign = id("foreign"),
  elsewhere = id("elsewhere");
const robin = id("robin"),
  sam = id("sam"),
  outsider = id("outsider"),
  third = id("third");
const account = id("account"),
  alternate = id("alternate"),
  proof = id("proof");
let claimId: string;
let activeOrg = partner;
let activeActor = actor;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const submit = () => client.claims.submit({ partnershipId: own });

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: actor,
      name: "Coordinator",
      email: `${actor}@example.org`,
      emailVerified: true,
    },
    {
      id: participantUser,
      name: "Participant",
      email: `${participantUser}@example.org`,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values(
    [host, partner, other].map((org) => ({
      id: org,
      name: org,
      slug: org,
      createdAt: now,
    })),
  );
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: actor,
      organizationId: host,
      role: "project-coordinator",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participantUser,
      organizationId: host,
      role: "participant",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: actor,
      organizationId: other,
      role: "participant",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: actor,
      organizationId: partner,
      role: "project-coordinator",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participantUser,
      organizationId: partner,
      role: "participant",
      createdAt: now,
    },
  ]);
  await db.insert(projects).values({
    id: project,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: host,
  });
  await db.insert(projects).values({
    id: secondProject,
    name: "Other hosted Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: host,
  });
  await db.insert(hostAssignments).values([
    { projectId: project, userId: actor },
    { projectId: secondProject, userId: actor },
  ]);
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
    { id: elsewhere, projectId: secondProject, organizationId: partner },
  ]);
  await db.insert(assignments).values([
    { partnershipId: own, userId: actor },
    { partnershipId: elsewhere, userId: actor },
    { partnershipId: own, userId: participantUser },
  ]);
  await db.insert(accounts).values(
    [account, alternate].map((accountId) => ({
      id: accountId,
      organizationId: partner,
      accountHolder: "Partner",
      iban: accountId,
    })),
  );
  await db.insert(participants).values([
    {
      id: robin,
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Robin",
    },
    {
      id: sam,
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Sam",
    },
    {
      id: outsider,
      projectId: project,
      representedOrganizationId: other,
      displayName: "Outsider",
    },
    {
      id: third,
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Third",
    },
  ]);
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: activeActor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(async () => {
  activeOrg = partner;
  activeActor = actor;
  if (claimId) await db.delete(history).where(eq(history.claimId, claimId));
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(selections).where(eq(selections.partnershipId, own));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, robin));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, sam));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, third));
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await client.claims.selectPayoutAccount({
    partnershipId: own,
    payoutAccountId: account,
  });
  claimId = (await client.claims.saveDraft({ partnershipId: own })).id;
});

afterAll(async () => {
  await db.delete(history).where(eq(history.claimId, claimId));
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(selections).where(eq(selections.partnershipId, own));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, robin));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, sam));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, third));
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(accounts).where(eq(accounts.organizationId, partner));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(assignments).where(eq(assignments.partnershipId, elsewhere));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(partnerships).where(eq(partnerships.projectId, secondProject));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(projects).where(eq(projects.id, secondProject));
  for (const org of [other, partner, host])
    await db.delete(member).where(eq(member.organizationId, org));
  for (const org of [other, partner, host])
    await db.delete(organization).where(eq(organization.id, org));
  for (const person of [participantUser, actor])
    await db.delete(user).where(eq(user.id, person));
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
  await db.insert(documents).values({
    id: proof,
    claimId: claimId,
    fileReference: "test/proof",
    originalFileName: "proof.pdf",
    mediaType: "application/pdf",
    byteSize: 1,
    checksum: "test",
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
    role: "project-coordinator",
    assigned: true,
  },
  { name: "Partner owner", side: "partner", role: "owner", assigned: false },
  { name: "Partner admin", side: "partner", role: "admin", assigned: false },
  {
    name: "Partner unassigned coordinator",
    side: "partner",
    role: "project-coordinator",
    assigned: false,
  },
  {
    name: "Partner unassigned participant",
    side: "partner",
    role: "participant",
    assigned: false,
  },
  {
    name: "Partner participant",
    side: "partner",
    role: "participant",
    assigned: true,
  },
  {
    name: "Hosting assigned coordinator",
    side: "host",
    role: "project-coordinator",
    assigned: true,
  },
  { name: "Hosting owner", side: "host", role: "owner", assigned: false },
  { name: "Hosting admin", side: "host", role: "admin", assigned: false },
  {
    name: "Hosting unassigned coordinator",
    side: "host",
    role: "project-coordinator",
    assigned: false,
  },
  {
    name: "Hosting unassigned participant",
    side: "host",
    role: "participant",
    assigned: false,
  },
  {
    name: "Hosting participant",
    side: "host",
    role: "participant",
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
    (role.role === "project-coordinator" && role.assigned) ||
    role.role === "owner" ||
    role.role === "admin"
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
    let entryId = "missing-entry";
    if (expected && procedure === "claims.submit") await prepare("100.00");
    if (procedure === "journeys.update") {
      await db.insert(journeys).values({
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
      await db.insert(documents).values({
        id: proof,
        claimId,
        fileReference: "test/matrix",
        originalFileName: "proof.pdf",
        mediaType: "application/pdf",
        byteSize: 1,
        checksum: "matrix",
      });
    }
    const statuses: Partial<
      Record<ClaimProcedure, "submitted" | "rejected" | "approved" | "paid">
    > = {
      "claims.requestCorrection": "submitted",
      "claims.approve": "submitted",
      "claims.reject": "submitted",
      "claims.reopen": "rejected",
      "claims.markPaid": "approved",
      "claims.correctPayment": "paid",
    };
    if (statuses[procedure])
      await db
        .update(claims)
        .set({ status: statuses[procedure], approvedAmountEur: "100.00" })
        .where(eq(claims.id, claimId));
    const orgId = role.side === "host" ? host : partner;
    const person = role.role === "participant" ? participantUser : actor;
    if (role.side === "partner" && !role.assigned)
      await db
        .delete(assignments)
        .where(
          and(eq(assignments.partnershipId, own), eq(assignments.userId, actor)),
        );
    if (role.side === "host" && (!role.assigned || role.role === "participant"))
      await db
        .delete(hostAssignments)
        .where(
          and(
            eq(hostAssignments.projectId, project),
            eq(hostAssignments.userId, actor),
          ),
        );
    await db
      .update(member)
      .set({ role: role.role })
      .where(and(eq(member.organizationId, orgId), eq(member.userId, person)));
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
      await db
        .update(member)
        .set({
          role:
            person === participantUser && orgId === partner
              ? "participant"
              : "project-coordinator",
        })
        .where(and(eq(member.organizationId, orgId), eq(member.userId, person)));
      if (role.side === "partner" && !role.assigned)
        await db
          .insert(assignments)
          .values({ partnershipId: own, userId: actor })
          .onConflictDoNothing();
      if (role.side === "host" && (!role.assigned || role.role === "participant"))
        await db
          .insert(hostAssignments)
          .values({ projectId: project, userId: actor })
          .onConflictDoNothing();
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
    await db
      .update(allocations)
      .set({ projectParticipantId: outsider })
      .where(
        and(
          eq(allocations.travelCostEntryId, train.id),
          eq(allocations.projectParticipantId, robin),
        ),
      );
    await db
      .update(entries)
      .set({ allocationMethod: "amount" })
      .where(eq(entries.id, train.id));
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
    await db
      .update(claims)
      .set({ status: "correction_requested" })
      .where(eq(claims.id, claimId));
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

async function asHost(role = "project-coordinator", userId = actor) {
  activeOrg = host;
  activeActor = userId;
  await db
    .update(member)
    .set({ role })
    .where(and(eq(member.organizationId, host), eq(member.userId, userId)));
}

async function submittedClaim() {
  await prepare("100.01");
  await submit();
  await asHost();
}

describe("Claim lock abuse", () => {
  it("does not hide a submitted retry's missing saved payable amount as an edit lock", async () => {
    await submittedClaim();
    await db
      .update(claims)
      .set({ approvedAmountEur: null })
      .where(eq(claims.id, claimId));
    const before = await events();
    activeOrg = partner;
    await expect(submit()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
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
        status: 404,
        message: "Claim not found in scope.",
        data: { reason: "CLAIM_NOT_FOUND" },
      });
    }
    expect(await events()).toEqual([]);
    activeOrg = partner;
    await expect(submit()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "CLAIM_REQUIRED_FOR_SUBMISSION" },
    });
  });

  it("cannot approve incomplete or unsubmitted Claims, confirms submitted payable and permanently locks Partner editing", async () => {
    await asHost();
    await expect(review("approve")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "CLAIM_SUBMITTED_REQUIRED" },
    });
    activeOrg = partner;
    await prepare("100.01");
    await asHost();
    await expect(review("approve")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await db
      .update(claims)
      .set({ status: "submitted", approvedAmountEur: null })
      .where(eq(claims.id, claimId));
    await expect(review("approve")).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
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
    await db.update(claims).set({ status: "paid" }).where(eq(claims.id, claimId));
    await expect(review("reopen")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await db.select().from(claims).where(eq(claims.id, claimId)))[0].status,
    ).toBe("paid");
  }, 15_000);

  it("enforces the Hosting role matrix on every review action and every Partnership", async () => {
    await submittedClaim();
    const actions = ["requestCorrection", "approve", "reject", "reopen"] as const;
    for (const role of ["owner", "admin", "project-coordinator"]) {
      await asHost(role);
      for (const action of actions) {
        await db
          .update(claims)
          .set({
            status: action === "reopen" ? "rejected" : "submitted",
            approvedAmountEur: "101.01",
          })
          .where(eq(claims.id, claimId));
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
    await asHost("participant");
    for (const action of actions) {
      await db
        .update(claims)
        .set({ status: action === "reopen" ? "rejected" : "submitted" })
        .where(eq(claims.id, claimId));
      await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    for (const role of ["participant", "project-coordinator"]) {
      await asHost(role, participantUser);
      for (const action of actions) {
        await db
          .update(claims)
          .set({ status: action === "reopen" ? "rejected" : "submitted" })
          .where(eq(claims.id, claimId));
        await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    await asHost("participant", participantUser);
    for (const action of actions) {
      await db
        .update(claims)
        .set({ status: action === "reopen" ? "rejected" : "submitted" })
        .where(eq(claims.id, claimId));
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
                status: 404,
                message: "Project Partnership not found in scope.",
                data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
              }
            : {
                code: "FORBIDDEN",
                status: 403,
                message: "Only Hosting staff may review Claims.",
              },
        );
      await expect(
        client.claims.getHistory({ partnershipId: foreign }),
      ).rejects.toMatchObject(
        org === other
          ? {
              code: "FORBIDDEN",
              status: 403,
              message:
                "You need Partner Organization staff access or an assignment to this Project Partnership.",
              data: { reason: "PARTNER_COORDINATION_REQUIRED" },
            }
          : {
              code: "NOT_FOUND",
              status: 404,
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
    await asHost("project-coordinator");
    for (const action of actions)
      await expect(
        client.claims[action]({ partnershipId: foreign, reason: "Reason" }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
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
      status: 400,
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
    for (const role of ["owner", "admin", "project-coordinator"]) {
      await asHost(role);
      await markPaid(payable);
      await correctPayment("Incorrect flag");
    }
    await asHost("participant", participantUser);
    await expect(markPaid(payable)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(claims).set({ status: "paid" }).where(eq(claims.id, claimId));
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
              status: 404,
              message: "Project Partnership not found in scope.",
              data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
            }
          : {
              code: "FORBIDDEN",
              status: 403,
              message: "Only Hosting staff may record payment.",
            },
      );
      await expect(correctPayment("Incorrect flag")).rejects.toMatchObject(
        org === other
          ? {
              code: "NOT_FOUND",
              status: 404,
              message: "Project Partnership not found in scope.",
              data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" },
            }
          : {
              code: "FORBIDDEN",
              status: 403,
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
      expect(types).toEqual(["submitted", "approved", "paid"]);
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
