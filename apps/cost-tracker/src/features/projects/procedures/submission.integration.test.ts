// @vitest-environment node
import { randomUUID } from "node:crypto";

import { PARTICIPANT_TRANSPORT_EMISSION_PROFILES } from "@greendex/config/transport-emission-profiles";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
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
import { and, eq } from "drizzle-orm";
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
  own = id("own"),
  foreign = id("foreign");
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
      role: "member",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participantUser,
      organizationId: host,
      role: "member",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: actor,
      organizationId: other,
      role: "member",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: actor,
      organizationId: partner,
      role: "member",
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
    responsibleUserId: actor,
  });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
  ]);
  await db.insert(assignments).values({ partnershipId: own, userId: actor });
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
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(accounts).where(eq(accounts.organizationId, partner));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(projects).where(eq(projects.id, project));
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

describe("Claim submission", () => {
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
    expect(await db.select().from(history)).toEqual([]);
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
    await expect(submit()).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
    expect(
      (await db.select().from(history).where(eq(history.claimId, claimId))).map(
        (event) => event.eventType,
      ),
    ).toEqual(["submitted", "resubmitted"]);
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

async function asHost(role = "member", userId = actor) {
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

describe("Host Claim review", () => {
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
      (await db.select().from(history).where(eq(history.claimId, claimId))).map(
        ({ eventType, reason, actorUserId, occurredAt }) => ({
          eventType,
          reason,
          actorUserId,
          occurredAt,
        }),
      ),
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

  it("cannot approve incomplete or unsubmitted Claims, confirms submitted payable and permanently locks Partner editing", async () => {
    await asHost();
    await expect(review("approve")).rejects.toMatchObject({
      code: "BAD_REQUEST",
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
      code: "BAD_REQUEST",
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
    expect(
      (await db.select().from(history).where(eq(history.claimId, claimId))).map(
        (event) => event.eventType,
      ),
    ).toEqual(["submitted", "approved"]);
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
    for (const role of ["owner", "admin", "member", "project-coordinator"]) {
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
    for (const role of ["member", "project-coordinator"]) {
      await asHost(role, participantUser);
      for (const action of actions) {
        await db
          .update(claims)
          .set({ status: action === "reopen" ? "rejected" : "submitted" })
          .where(eq(claims.id, claimId));
        await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    await asHost("member", participantUser);
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
        await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        client.claims.getHistory({ partnershipId: foreign }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    activeOrg = partner;
    activeActor = participantUser;
    for (const action of actions)
      await expect(review(action)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.claims.getHistory({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await asHost("member");
    for (const action of actions)
      await expect(
        client.claims[action]({ partnershipId: foreign, reason: "Reason" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 15_000);
});

const markPaid = (amountEur: string) =>
  client.claims.markPaid({ partnershipId: own, amountEur });
const correctPayment = (reason?: string) =>
  client.claims.correctPayment({ partnershipId: own, reason: reason ?? "" });
const events = () =>
  db.select().from(history).where(eq(history.claimId, claimId));

async function approvedClaim() {
  await submittedClaim();
  const approved = await review("approve");
  return approved.approvedAmountEur!;
}

describe("Claim payment recording", () => {
  it("rejects unpaid drafts, submissions and rejections without writing history", async () => {
    await asHost();
    await expect(markPaid("101.01")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/approved.*unpaid/i),
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
  });

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
  });

  it("limits payment actions to Hosting owners, admins and assigned coordinators", async () => {
    const payable = await approvedClaim();
    for (const role of ["owner", "admin", "project-coordinator"]) {
      await asHost(role);
      await markPaid(payable);
      await correctPayment("Incorrect flag");
    }
    await asHost("member", participantUser);
    await expect(markPaid(payable)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(claims).set({ status: "paid" }).where(eq(claims.id, claimId));
    await expect(correctPayment("Incorrect flag")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    for (const org of [partner, other]) {
      activeOrg = org;
      activeActor = actor;
      await expect(markPaid(payable)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(correctPayment("Incorrect flag")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});
