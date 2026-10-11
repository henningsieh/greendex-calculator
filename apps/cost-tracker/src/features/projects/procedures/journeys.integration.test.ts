// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimHistoryTable as history,
  claimsTable as claims,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  participantJourneysTable as journeys,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
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
const id = (part: string) => `journey-${part}-${suffix}`;
const host = id("host"),
  partner = id("partner"),
  other = id("other");
const coordinator = id(ORGANIZATION_ROLES.ProjectCoordinator),
  participantUser = id("user");
const project = id("project"),
  secondProject = id("second-project");
const own = id("own"),
  foreign = id("foreign"),
  next = id("next");
const first = id("first"),
  second = id("second"),
  outside = id("outside"),
  later = id("later");
let claimId: string | undefined;
let actor = coordinator;
let activeOrg = partner;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
async function createEditableClaim() {
  claimId = (
    await db
      .insert(claims)
      .values({ partnershipId: own })
      .returning({ id: claims.id })
  )[0].id;
}
const journey = {
  partnershipId: own,
  projectParticipantId: first,
  origin: "Berlin",
  destination: "Riga",
  tripType: "round-trip" as const,
  erasmusDistanceKm: "850.25",
};

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: coordinator,
      name: "Coordinator",
      email: `${coordinator}@example.org`,
      emailVerified: true,
    },
    {
      id: participantUser,
      name: "Participant",
      email: `${participantUser}@example.org`,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values([
    { country: "DE", id: host, name: "Host", slug: host, createdAt: now },
    {
      country: "DE",
      id: partner,
      name: "Partner",
      slug: partner,
      createdAt: now,
    },
    { country: "DE", id: other, name: "Other", slug: other, createdAt: now },
  ]);
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: partner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participantUser,
      organizationId: partner,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
  ]);
  await db.insert(projects).values(
    [project, secondProject].map((projectId) => ({
      id: projectId,
      name: "Project",
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV" as const,
      organizationId: host,
    })),
  );
  await db
    .insert(hostAssignments)
    .values({ projectId: project, userId: coordinator });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
    { id: next, projectId: secondProject, organizationId: partner },
  ]);
  await db.insert(assignments).values([
    { partnershipId: own, userId: coordinator },
    { partnershipId: next, userId: coordinator },
  ]);
  await db.insert(participants).values([
    {
      id: first,
      projectId: project,
      representedOrganizationId: partner,
      displayName: "First",
    },
    {
      id: second,
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Second",
    },
    {
      id: outside,
      projectId: project,
      representedOrganizationId: other,
      displayName: "Outside",
    },
    {
      id: later,
      projectId: secondProject,
      representedOrganizationId: partner,
      displayName: "Later",
    },
  ]);
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(async () => {
  actor = coordinator;
  activeOrg = partner;
  if (claimId) await db.delete(history).where(eq(history.claimId, claimId));
  await db.delete(claims).where(eq(claims.partnershipId, own));
  claimId = undefined;
  await db.delete(journeys).where(eq(journeys.projectParticipantId, first));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, second));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, later));
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await db.delete(snapshots).where(eq(snapshots.projectId, secondProject));
});

afterAll(async () => {
  if (claimId) await db.delete(history).where(eq(history.claimId, claimId));
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, first));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, second));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, later));
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await db.delete(snapshots).where(eq(snapshots.projectId, secondProject));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(participants).where(eq(participants.projectId, secondProject));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(assignments).where(eq(assignments.partnershipId, next));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(partnerships).where(eq(partnerships.projectId, secondProject));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(projects).where(eq(projects.id, secondProject));
  await db.delete(member).where(eq(member.organizationId, partner));
  for (const orgId of [other, partner, host])
    await db.delete(organization).where(eq(organization.id, orgId));
  for (const userId of [participantUser, coordinator])
    await db.delete(user).where(eq(user.id, userId));
});

describe("Participant Journey procedures", () => {
  it("reports each missing field, not just the first", async () => {
    await expect(
      client.journeys.save({
        partnershipId: own,
        projectParticipantId: first,
      } as typeof journey),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: [
          { path: ["origin"] },
          { path: ["destination"] },
          { path: ["tripType"] },
          { path: ["erasmusDistanceKm"] },
        ],
      },
    });
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual([]);
  });

  it("rejects blank locations, invalid trip types and nonpositive or overprecise distance", async () => {
    for (const patch of [
      { origin: "   " },
      { destination: "" },
      { tripType: "return" },
      { erasmusDistanceKm: "0" },
      { erasmusDistanceKm: "-1" },
      { erasmusDistanceKm: "123.456" },
      { erasmusDistanceKm: "1234567890123" },
    ]) {
      await expect(
        client.journeys.save({ ...journey, ...patch } as typeof journey),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(
      await db
        .select()
        .from(journeys)
        .where(eq(journeys.projectParticipantId, first)),
    ).toEqual([]);
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual([]);
  });

  it("copies every funding input atomically on first save, and rejects a second journey", async () => {
    const saved = await client.journeys.save(journey);
    expect(saved).toMatchObject({
      projectParticipantId: first,
      origin: "Berlin",
      destination: "Riga",
      tripType: "round-trip",
      erasmusDistanceKm: "850.25",
    });
    const [snapshot] = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, project));
    const copiedBands = await db
      .select()
      .from(bands)
      .where(eq(bands.projectId, project));
    expect(snapshot.rulesVersion).toBe(TRAVEL_FUNDING_RULES.version);
    expect(snapshot.participantTransportProfiles).toEqual(
      TRAVEL_FUNDING_RULES.participantTransportProfiles,
    );
    expect(
      copiedBands.map(({ minKm, maxKm, standardEur, greenEur }) => ({
        minKm: Number(minKm),
        maxKm: Number(maxKm),
        standardEur: Number(standardEur),
        greenEur: Number(greenEur),
      })),
    ).toEqual(TRAVEL_FUNDING_RULES.bands);
    await expect(client.journeys.save(journey)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      await db
        .select()
        .from(journeys)
        .where(eq(journeys.projectParticipantId, first)),
    ).toHaveLength(1);
    expect(
      await db.select().from(bands).where(eq(bands.projectId, project)),
    ).toHaveLength(TRAVEL_FUNDING_RULES.bands.length);
  });

  it("rolls back the first snapshot when band copying fails", async () => {
    const configBands = TRAVEL_FUNDING_RULES.bands as unknown as {
      greenEur: number;
    }[];
    const originalRate = configBands[0].greenEur;
    try {
      configBands[0].greenEur = -1;
      await expect(client.journeys.save(journey)).rejects.toThrow();
      expect(
        await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(journeys)
          .where(eq(journeys.projectParticipantId, first)),
      ).toEqual([]);
    } finally {
      configBands[0].greenEur = originalRate;
    }
  });

  it("serializes simultaneous first saves on one Project", async () => {
    const [a, b] = await Promise.all([
      client.journeys.save(journey),
      client.journeys.save({ ...journey, projectParticipantId: second }),
    ]);
    expect([a.projectParticipantId, b.projectParticipantId]).toEqual([
      first,
      second,
    ]);
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toHaveLength(1);
    expect(
      await db.select().from(bands).where(eq(bands.projectId, project)),
    ).toHaveLength(TRAVEL_FUNDING_RULES.bands.length);
  });

  it("keeps earlier snapshots unchanged when config changes", async () => {
    await db.insert(journeys).values({
      projectParticipantId: first,
      origin: "Old",
      destination: "Riga",
      tripType: "one-way",
      erasmusDistanceKm: "500",
    });
    await expect(client.journeys.save(journey)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual([]);
    await client.journeys.save({ ...journey, projectParticipantId: second });
    const original = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, project));
    const originalBands = await db
      .select()
      .from(bands)
      .where(eq(bands.projectId, project));
    const profiles =
      TRAVEL_FUNDING_RULES.participantTransportProfiles as unknown as string[];
    const initial = profiles[0];
    const configBands = TRAVEL_FUNDING_RULES.bands as unknown as {
      greenEur: number;
    }[];
    const initialRate = configBands[0].greenEur;
    try {
      profiles[0] = "changed-later";
      configBands[0].greenEur = 999;
      await client.journeys.save({
        ...journey,
        partnershipId: next,
        projectParticipantId: later,
      });
      expect(
        (
          await db
            .select()
            .from(snapshots)
            .where(eq(snapshots.projectId, project))
        ).map(({ participantTransportProfiles }) => participantTransportProfiles),
      ).toEqual(
        original.map(
          ({ participantTransportProfiles }) => participantTransportProfiles,
        ),
      );
      expect(
        await db.select().from(bands).where(eq(bands.projectId, project)),
      ).toEqual(originalBands);
      expect(
        (
          await db
            .select()
            .from(snapshots)
            .where(eq(snapshots.projectId, secondProject))
        )[0].participantTransportProfiles,
      ).toContain("changed-later");
      expect(
        (
          await db.select().from(bands).where(eq(bands.projectId, secondProject))
        )[0].greenEur,
      ).toBe("999.00");
    } finally {
      profiles[0] = initial;
      configBands[0].greenEur = initialRate;
    }
  });

  it("updates each journey field in place without adding a second journey", async () => {
    const saved = await client.journeys.save(journey);
    await createEditableClaim();
    for (const [patch, expected] of [
      [{ origin: "Tallinn" }, { origin: "Tallinn" }],
      [{ destination: "Vilnius" }, { destination: "Vilnius" }],
      [{ tripType: "one-way" }, { tripType: "one-way" }],
      [{ erasmusDistanceKm: "1030" }, { erasmusDistanceKm: "1030.00" }],
    ] as const) {
      const updated = await client.journeys.update({ ...journey, ...patch });
      expect(updated).toMatchObject({ id: saved.id, ...expected });
    }
    expect(
      await db
        .select()
        .from(journeys)
        .where(eq(journeys.projectParticipantId, first)),
    ).toHaveLength(1);
  });

  it("validates update fields with the same itemized errors as save", async () => {
    const saved = await client.journeys.save(journey);
    await createEditableClaim();
    await expect(
      client.journeys.update({
        partnershipId: own,
        projectParticipantId: first,
      } as typeof journey),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        issues: [
          { path: ["origin"] },
          { path: ["destination"] },
          { path: ["tripType"] },
          { path: ["erasmusDistanceKm"] },
        ],
      },
    });
    for (const patch of [
      { origin: "   " },
      { destination: "" },
      { tripType: "return" },
      { erasmusDistanceKm: "0" },
      { erasmusDistanceKm: "-1" },
      { erasmusDistanceKm: "123.456" },
      { erasmusDistanceKm: "1234567890123" },
    ]) {
      await expect(
        client.journeys.update({ ...journey, ...patch } as typeof journey),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(
      (await db.select().from(journeys).where(eq(journeys.id, saved.id)))[0]
        .origin,
    ).toBe("Berlin");
  });

  it("rejects distances outside exactly one frozen band without changing the snapshot", async () => {
    const saved = await client.journeys.save(journey);
    await createEditableClaim();
    const originalSnapshot = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, project));
    const originalBands = await db
      .select()
      .from(bands)
      .where(eq(bands.projectId, project));
    await expect(
      client.journeys.update({ ...journey, erasmusDistanceKm: "9999999999.99" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { issues: [{ path: ["erasmusDistanceKm"] }] },
    });
    const configBands = TRAVEL_FUNDING_RULES.bands as unknown as {
      minKm: number;
      maxKm: number;
    }[];
    const oldMin = configBands[0].minKm;
    try {
      configBands[0].minKm = 99999;
      const updated = await client.journeys.update({
        ...journey,
        erasmusDistanceKm: String(originalBands[0].minKm),
      });
      expect(updated.id).toBe(saved.id);
    } finally {
      configBands[0].minKm = oldMin;
    }
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual(originalSnapshot);
    expect(
      await db.select().from(bands).where(eq(bands.projectId, project)),
    ).toEqual(originalBands);
  });

  it("treats overlapping frozen bands as a server invariant without changing the Journey", async () => {
    const saved = await client.journeys.save(journey);
    await createEditableClaim();
    const [overlap] = await db
      .insert(bands)
      .values({
        projectId: project,
        minKm: "800",
        maxKm: "900",
        standardEur: "10",
        greenEur: "20",
      })
      .returning({ id: bands.id });
    try {
      await expect(
        client.journeys.update({ ...journey, origin: "Changed" }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        data: { reason: "INTERNAL_FAILURE" },
      });
      expect(
        (await db.select().from(journeys).where(eq(journeys.id, saved.id)))[0]
          .origin,
      ).toBe(journey.origin);
      expect(
        await db.select().from(history).where(eq(history.claimId, claimId!)),
      ).toHaveLength(0);
    } finally {
      await db.delete(bands).where(eq(bands.id, overlap!.id));
    }
  });

  it.each([
    "editable",
    "correction_requested",
    "submitted",
    "approved",
    "rejected",
    "paid",
  ] as const)(
    "gates %s updates and audits correction edits only",
    async (status) => {
      const saved = await client.journeys.save(journey);
      claimId = (
        await db
          .insert(claims)
          .values({ partnershipId: own, status })
          .returning({ id: claims.id })
      )[0].id;
      const input = { ...journey, origin: "Tallinn" };
      if (status === "editable" || status === "correction_requested") {
        expect(await client.journeys.update(input)).toMatchObject({
          id: saved.id,
          origin: "Tallinn",
        });
      } else {
        await expect(client.journeys.update(input)).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
        expect(
          (await db.select().from(journeys).where(eq(journeys.id, saved.id)))[0]
            .origin,
        ).toBe("Berlin");
      }
      const events = await db
        .select()
        .from(history)
        .where(eq(history.claimId, claimId));
      expect(events).toHaveLength(status === "correction_requested" ? 1 : 0);
      if (status === "correction_requested")
        expect(events[0]).toMatchObject({
          eventType: "journey_updated",
          actorUserId: coordinator,
          occurredAt: expect.any(Date),
          reason: null,
        });
    },
  );

  it("denies out-of-scope, missing and Participant updates", async () => {
    await client.journeys.save(journey);
    await expect(client.journeys.update(journey)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await createEditableClaim();
    await expect(
      client.journeys.update({ ...journey, projectParticipantId: second }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.update({ ...journey, projectParticipantId: outside }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.update({ ...journey, partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(client.journeys.update(journey)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    activeOrg = partner;
    actor = participantUser;
    await expect(client.journeys.update(journey)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("scopes reads and writes to the active Partner coordinator, denying Participants and foreign participations", async () => {
    await expect(
      client.journeys.save({ ...journey, projectParticipantId: outside }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.save({ ...journey, partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(client.journeys.save(journey)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    activeOrg = partner;
    actor = participantUser;
    await expect(client.journeys.save(journey)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      client.journeys.list({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    actor = coordinator;
    await client.journeys.save(journey);
    expect(await client.journeys.list({ partnershipId: own })).toMatchObject([
      { projectParticipantId: first },
    ]);
    await expect(
      client.journeys.list({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
