// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  claimHistoryTable as history,
  claimsTable as claims,
  participantJourneysTable as journeys,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
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

// Stable identities registered in SEED_SCENARIOS.costTrackerJourneys.
const id = (part: string) => `journey-${part}-canonical`;
const host = id("host"),
  partner = id("partner");
const coordinator = id(ORGANIZATION_ROLES.ProjectCoordinator),
  participantUser = id("user");
const scenarioNames = [
  "empty",
  "editable",
  "legacy",
  "correction_requested",
  "submitted",
  "approved",
  "rejected",
  "paid",
] as const;
type JourneyScenario = (typeof scenarioNames)[number];
let project: string,
  secondProject: string,
  own: string,
  foreign: string,
  next: string;
let first: string, second: string, outside: string, later: string;
let claimId: string | undefined;
const baselineClaims = new Map<JourneyScenario, string>();
function useScenario(name: JourneyScenario) {
  const scenarioId = (part: string) => id(`${name}-${part}`);
  project = scenarioId("project");
  secondProject = scenarioId("second-project");
  own = scenarioId("own");
  foreign = scenarioId("foreign");
  next = scenarioId("next");
  first = scenarioId("first");
  second = scenarioId("second");
  outside = scenarioId("outside");
  later = scenarioId("later");
  claimId = baselineClaims.get(name);
  journey.partnershipId = own;
  journey.projectParticipantId = first;
}
let actor = coordinator;
let activeOrg = partner;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const journey = {
  partnershipId: "",
  projectParticipantId: "",
  origin: "Berlin",
  destination: "Riga",
  tripType: "round-trip" as const,
  erasmusDistanceKm: "850.25",
};

beforeAll(async () => {
  for (const name of scenarioNames) {
    const partnershipId = id(`${name}-own`);
    const row = await db.query.projectsTable.findFirst({
      where: (row, { eq }) => eq(row.id, id(`${name}-project`)),
    });
    if (!row)
      throw new Error(
        "Canonical seed required: run the isolated seeded lifecycle.",
      );
    const claim = await db.query.claimsTable.findFirst({
      where: eq(claims.partnershipId, partnershipId),
    });
    if (claim) baselineClaims.set(name, claim.id);
  }
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(() => {
  actor = coordinator;
  activeOrg = partner;
  useScenario("empty");
});

afterEach(async () => {
  // Only procedure outputs are removed; canonical Claims and the legacy Journey remain.
  for (const name of scenarioNames) {
    const baselineClaimId = baselineClaims.get(name);
    if (baselineClaimId)
      await db.delete(history).where(eq(history.claimId, baselineClaimId));
    for (const part of ["first", "second", "later"]) {
      if (
        ["legacy", "submitted", "approved", "rejected", "paid"].includes(name) &&
        part === "first"
      )
        continue;
      await db
        .delete(journeys)
        .where(eq(journeys.projectParticipantId, id(`${name}-${part}`)));
    }
    for (const part of ["project", "second-project"])
      await db
        .delete(snapshots)
        .where(eq(snapshots.projectId, id(`${name}-${part}`)));
  }
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
        reason: "INVALID_INPUT",
        issues: [
          {
            id: "journeyOriginRequired",
            path: ["origin"],
            message: "Enter a Journey origin.",
          },
          {
            id: "journeyDestinationRequired",
            path: ["destination"],
            message: "Enter a Journey destination.",
          },
          {
            id: "journeyTripTypeRequired",
            path: ["tripType"],
            message: "Select a Journey trip type.",
          },
          {
            id: "journeyDistanceRequired",
            path: ["erasmusDistanceKm"],
            message: "Enter a positive exact Erasmus distance.",
          },
        ],
      },
    });
    expect(
      await db.select().from(snapshots).where(eq(snapshots.projectId, project)),
    ).toEqual([]);
  });

  it("reports known field issues when the Participation identifier is missing", async () => {
    const error = await client.journeys
      .save({ partnershipId: own } as typeof journey)
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      data: {
        reason: "INVALID_INPUT",
        issues: [
          { path: ["origin"] },
          { path: ["destination"] },
          { path: ["tripType"] },
          { path: ["erasmusDistanceKm"] },
        ],
      },
    });
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
      code: "CONFLICT",
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
    useScenario("legacy");
    await expect(client.journeys.save(journey)).rejects.toMatchObject({
      code: "CONFLICT",
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
    useScenario("editable");
    const saved = await client.journeys.save(journey);
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
    useScenario("editable");
    const saved = await client.journeys.save(journey);
    await expect(
      client.journeys.update({
        partnershipId: own,
        projectParticipantId: first,
      } as typeof journey),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: {
        reason: "INVALID_INPUT",
        issues: [
          {
            id: "journeyOriginRequired",
            path: ["origin"],
          },
          {
            id: "journeyDestinationRequired",
            path: ["destination"],
          },
          {
            id: "journeyTripTypeRequired",
            path: ["tripType"],
          },
          {
            id: "journeyDistanceRequired",
            path: ["erasmusDistanceKm"],
          },
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
    useScenario("editable");
    const saved = await client.journeys.save(journey);
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
      data: {
        reason: "JOURNEY_DISTANCE_OUTSIDE_BANDS",
        issues: [
          { id: "journeyDistanceOutsideBands", path: ["erasmusDistanceKm"] },
        ],
      },
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
    useScenario("editable");
    const saved = await client.journeys.save(journey);
    // Deliberate frozen-band corruption is the invariant under test, restored below.
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
      useScenario(status);
      const saved =
        status === "editable" || status === "correction_requested"
          ? await client.journeys.save(journey)
          : (
              await db
                .select()
                .from(journeys)
                .where(eq(journeys.projectParticipantId, first))
            )[0];
      const input = { ...journey, origin: "Tallinn" };
      if (status === "editable" || status === "correction_requested") {
        expect(await client.journeys.update(input)).toMatchObject({
          id: saved.id,
          origin: "Tallinn",
        });
      } else {
        await expect(client.journeys.update(input)).rejects.toMatchObject({
          code: "CONFLICT",
        });
        expect(
          (await db.select().from(journeys).where(eq(journeys.id, saved.id)))[0]
            .origin,
        ).toBe("Berlin");
      }
      const events = await db
        .select()
        .from(history)
        .where(eq(history.claimId, claimId!));
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
    useScenario("editable");
    await client.journeys.save(journey);
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
