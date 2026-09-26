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
  await db.delete(history).where(eq(history.actorUserId, actor));
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
  await db.delete(history).where(eq(history.actorUserId, actor));
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
  await db.delete(member).where(eq(member.organizationId, partner));
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
