// @vitest-environment node
import { randomUUID } from "node:crypto";

import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
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
const coordinator = id("coordinator"),
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
let actor = coordinator;
let activeOrg = partner;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
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
    { id: host, name: "Host", slug: host, createdAt: now },
    { id: partner, name: "Partner", slug: partner, createdAt: now },
    { id: other, name: "Other", slug: other, createdAt: now },
  ]);
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: coordinator,
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
  await db.insert(projects).values(
    [project, secondProject].map((projectId) => ({
      id: projectId,
      name: "Project",
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV" as const,
      organizationId: host,
      responsibleUserId: coordinator,
    })),
  );
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
  await db.delete(journeys).where(eq(journeys.projectParticipantId, first));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, second));
  await db.delete(journeys).where(eq(journeys.projectParticipantId, later));
  await db.delete(snapshots).where(eq(snapshots.projectId, project));
  await db.delete(snapshots).where(eq(snapshots.projectId, secondProject));
});

afterAll(async () => {
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

  it("scopes reads and writes to the active Partner coordinator, denying Participants and foreign participations", async () => {
    await expect(
      client.journeys.save({ ...journey, projectParticipantId: outside }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.journeys.save({ ...journey, partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
