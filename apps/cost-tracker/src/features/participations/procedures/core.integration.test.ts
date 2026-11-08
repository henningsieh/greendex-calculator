// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  partnerCoordinatorAssignmentsTable as assignments,
  projectParticipantsTable as participants,
  duplicateReviewTasksTable as reviewTasks,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";

import { createParticipationProcedures } from "@/features/participations/procedures/core";
import { duplicateReviews } from "@/features/participations/procedures/duplicate-reviews";
import {
  assignPartnerCoordinator,
  removePartnerCoordinator,
} from "@/features/partnerships/procedures/coordination";

// Stable identities registered in SEED_SCENARIOS.costTrackerParticipations.
const host = "ycvohy4h4kwieafr6898z8kv";
const partner = "y1trk5u6aktm6ydac8hkedqw";
const other = "qm1q3p423syonhiz03hapvo2";
let project: string;
let own: string;
let foreign: string;
const coordinator = "yk6wubi79tj3ebwz8yd9x08t";
const candidate = "qvgz7f1iyhnu7gp1lgxxo0xr";
const emptyProject = "kpygjkont86bnf0papoa4kc8";
const unassigned = "f5i4bmbo7wrhagns7u47kg9i";
const email = "qvgz7f1iyhnu7gp1lgxxo0xr@example.org";
const scenarioNames = [
  "empty",
  "email",
  "mixed",
  "old-email",
  "foreign-invitation",
  "own-invitation",
  "referenced",
  "submitted",
  "correction",
  "report",
  "report-empty",
] as const;
const participationScenarioIds = [
  {
    project: "qy0kb70zdth2bsozm38lyyal",
    own: "buqd9fv4ybyktdek9p64m7jm",
    foreign: "mgz4dfav64uk03sv0h0aa2es",
  }, // empty
  {
    project: "niym6uhqv3ab67no8xczirfm",
    own: "qb2kl16qn1hu2ohtrryck7m6",
    foreign: "bxq8dw1qgqr1ado7aj2t5pnh",
  }, // email
  {
    project: "jkpjg005rsnnk5wu8vu19l4y",
    own: "ey2yp9oh84cx5ejrx2r34vod",
    foreign: "wuwbqgb048nzlvs9i48hp5ix",
  }, // mixed
  {
    project: "pcejbr6jijv9xku2ryk2cmcg",
    own: "oe0a8sv4vhr01f9m3uj9dqty",
    foreign: "w8dgvghe9vqy9betz3vfnr3c",
  }, // old-email
  {
    project: "iy7j18jcstttime1pek0v8i6",
    own: "gywyrmx7v842y3173n2m691w",
    foreign: "m85eipkiekpa8p4gjyt14rmr",
  }, // foreign-invitation
  {
    project: "u8ttgplmlamal88vzjc71ghm",
    own: "a5uk96o7uxw9eqfdmtdjzcsg",
    foreign: "lm51d924zdrwauk77oy66rwy",
  }, // own-invitation
  {
    project: "y2lt460o2dp1zdz3dxtc7az0",
    own: "rrgnrplv6g4wx6etvt0uorp0",
    foreign: "v29eadhvqwogioedzai0lpwi",
  }, // referenced
  {
    project: "bvddx0xi4oj1umogqqpe1f0z",
    own: "sxpfxlvmh9fqlagl4p9ho9ry",
    foreign: "yid1un03hn6x3snfhh607n7q",
  }, // submitted
  {
    project: "k585rjkr7rymcz8wju1oz5ey",
    own: "oh6z766sc05cjol3glr9jyzf",
    foreign: "q4r357azwi64ibqzic5vhy0o",
  }, // correction
  {
    project: "a4ol9541l649heo3fdt1sdsq",
    own: "r11iu43lohcnxcs3immmv7q5",
    foreign: "t9ykibatvqqu4ogg8xfkm6jy",
  }, // report
  {
    project: "kpygjkont86bnf0papoa4kc8",
    own: "wy0ehkrybncqx4tdjx8hmb8r",
    foreign: "o98tmj5zsnen8q1vw8qpwtgj",
  }, // report-empty
] as const;
function useScenario(name: (typeof scenarioNames)[number]) {
  const ids = participationScenarioIds[scenarioNames.indexOf(name)]!;
  project = ids.project;
  own = ids.own;
  foreign = ids.foreign;
}
let baselineCorrection: typeof participants.$inferSelect | undefined;
let actor = coordinator;
let activeOrg = partner;
const version = { id: "fixture-v1", contentHash: "fixture-hash" };
const client = createRouterClient(
  {
    participations: createParticipationProcedures(() => version),
    duplicateReviews,
    assignments: {
      assign: assignPartnerCoordinator,
      remove: removePartnerCoordinator,
    },
  },
  { context: async () => ({ headers: new Headers() }) },
);

beforeAll(async () => {
  baselineCorrection = await db.query.projectParticipantsTable.findFirst({
    where: eq(participants.id, "d8cqmpxlvlyjvvki4gyzl32f"),
  });
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(() => {
  actor = coordinator;
  activeOrg = partner;
  useScenario("empty");
  // Stands in for Better Auth's supported server check against the active Membership.
  authMocks.hasPermission.mockImplementation(
    async ({ body }: { body: { permissions: Record<string, string[]> } }) => {
      if (!activeOrg) throw new Error("NO_ACTIVE_ORGANIZATION");
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(eq(member.userId, actor), eq(member.organizationId, activeOrg)),
        )
        .limit(1);
      const role = membership?.role;
      if (!role) throw new Error("USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION");
      return {
        success: parseOrganizationRoles(role).some(
          (name) =>
            name in costTrackerOrganizationRoles &&
            costTrackerOrganizationRoles[
              name as keyof typeof costTrackerOrganizationRoles
            ].authorize(body.permissions as never).success,
        ),
      };
    },
  );
});

afterEach(async () => {
  // Only behavior outputs in the empty coordination scenario are removed.
  await db.delete(reviewTasks).where(
    inArray(
      reviewTasks.partnershipId,
      scenarioNames.map(
        (name) => participationScenarioIds[scenarioNames.indexOf(name)]!.own,
      ),
    ),
  );
  await db
    .delete(participants)
    .where(eq(participants.projectId, "qy0kb70zdth2bsozm38lyyal"));
  await db
    .delete(assignments)
    .where(
      and(
        eq(assignments.partnershipId, "buqd9fv4ybyktdek9p64m7jm"),
        eq(assignments.userId, candidate),
      ),
    );
  // Removal/update of the seed correction Participation is behavior under test.
  const row = baselineCorrection;
  if (row) {
    await db
      .insert(participants)
      .values(row)
      .onConflictDoUpdate({ target: participants.id, set: row });
  }
});

describe("assignment-scoped participation coordination", () => {
  it("searches only currently onboarded Host users by ID, email, or profile name without disclosing email", async () => {
    const query = (search: string, partnershipId = own) =>
      client.participations.searchOnboarded({ partnershipId, search });
    const expected = [{ id: candidate, name: "Candidate" }];
    expect(await query(candidate)).toEqual(expected);
    expect(await query(email.toUpperCase())).toEqual(expected);
    expect(await query("CANDIDATE")).toEqual(expected);
    expect(await query("%_")).toEqual([]);
    await expect(query("c")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(query("x".repeat(129))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(query(candidate, foreign)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    activeOrg = host;
    await expect(query(candidate)).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = partner;
    actor = candidate;
    await expect(query(candidate)).rejects.toMatchObject({ code: "FORBIDDEN" });
    authMocks.getSession.mockResolvedValueOnce(null);
    await expect(query(candidate)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("excludes unverified, missing-profile, stale-acceptance, wrong-role, and non-Host users", async () => {
    const ids = [
      "l0w9g4n0cbb3wza1tzuu847m",
      "x7t57jutj2wmcih2pvlqjopb",
      "rornt3es93uoymcfmw6md2he",
      "h3ginec0jtgjtp8c9bxpkv2w",
      "faev6x3yt3v8nynvbnvych45",
    ];
    expect(
      await client.participations.searchOnboarded({
        partnershipId: own,
        search: `directory-`,
      }),
    ).toEqual([]);
    expect(
      await client.participations.searchOnboarded({
        partnershipId: own,
        search: "Directory Candidate",
      }),
    ).toEqual([]);
    for (const id of ids) {
      await expect(
        client.participations.create({ partnershipId: own, userId: id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("caps directory results at 20 minimal rows", async () => {
    const result = await client.participations.searchOnboarded({
      partnershipId: own,
      search: "@example.org",
    });
    expect(result).toHaveLength(20);
    expect(
      result.every((row) => Object.keys(row).sort().join() === "id,name"),
    ).toBe(true);
  });

  it("separates the actor's missing saved profile from current agreement acceptance", async () => {
    actor = candidate;
    activeOrg = host;
    actor = "jwgmepz6x7kuk7n3y5c4cmkx";
    await expect(
      client.participations.listMine({ projectId: project }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
    });
    actor = "h6fk257q3py9rhd1rmo60jcz";
    await expect(
      client.participations.listMine({ projectId: project }),
    ).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      data: { reason: "PARTICIPANT_PROFILE_REQUIRED" },
    });
  });

  it("does not search against an unpublished agreement", async () => {
    const unpublished = createRouterClient(
      {
        participations: createParticipationProcedures(() => ({
          id: "PENDING-LEGAL-001",
          contentHash: "",
        })),
      },
      { context: async () => ({ headers: new Headers() }) },
    );
    await expect(
      unpublished.participations.searchOnboarded({
        partnershipId: own,
        search: candidate,
      }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("creates for an onboarded user, lists, updates and removes within the assigned Partnership", async () => {
    const created = await client.participations.create({
      partnershipId: own,
      userId: candidate,
    });
    expect(created).toMatchObject({
      projectId: project,
      representedOrganizationId: partner,
      userId: candidate,
    });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .participations,
    ).toHaveLength(1);
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .projectName,
    ).toBe("Seed Participation Project empty");
    actor = candidate;
    activeOrg = host;
    expect(
      await client.participations.listMine({ projectId: project }),
    ).toHaveLength(1);
    await expect(
      client.participations.listHosted({ projectId: project }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    actor = coordinator;
    activeOrg = partner;
    expect(
      await client.participations.update({
        partnershipId: own,
        id: created.id,
        country: "DE",
      }),
    ).toMatchObject({ country: "DE" });
    await expect(
      client.participations.create({ partnershipId: own, userId: candidate }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/merge review/i),
    });
    await expect(
      client.participations.create({ partnershipId: foreign, userId: candidate }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.participations.listPartnership({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.participations.update({
        partnershipId: foreign,
        id: created.id,
        country: "FR",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.participations.remove({ partnershipId: foreign, id: created.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    expect(
      await client.participations.listHosted({ projectId: project }),
    ).toHaveLength(1);
    await expect(
      client.participations.remove({ partnershipId: own, id: created.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = partner;
    await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    await client.participations.remove({ partnershipId: own, id: created.id });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .participations,
    ).toEqual([]);
  });

  it("rejects a normalized email collision with merge review", async () => {
    useScenario("email");
    const placeholder = { id: "sl84191j69cov4uufubu7vr1" };
    try {
      await expect(
        client.participations.create({ partnershipId: own, userId: candidate }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringMatching(/merge review/i),
      });
      expect(await client.duplicateReviews.list({ partnershipId: own })).toEqual([
        expect.objectContaining({
          existingParticipationId: placeholder!.id,
          candidateUserId: candidate,
          status: "open",
        }),
      ]);
    } finally {
      await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    }
  });

  it("detects the same email across case variants via normalization", async () => {
    useScenario("mixed");
    const placeholder = { id: "mfbuvifruot8cgf124qosc6w" };
    const mixedUser = "r8ekilum3fbuhjkmk4hkx9lc";
    try {
      await expect(
        client.participations.create({
          partnershipId: own,
          userId: mixedUser,
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: expect.stringMatching(/merge review/i),
      });
      expect(await client.duplicateReviews.list({ partnershipId: own })).toEqual([
        expect.objectContaining({
          existingParticipationId: placeholder!.id,
          candidateUserId: mixedUser,
          status: "open",
        }),
      ]);
    } finally {
      await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    }
  });

  it("persists one review task for repeated same-User attempts and enforces self-assignment and resolution", async () => {
    const existing = await client.participations.create({
      partnershipId: own,
      userId: candidate,
    });
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(
        client.participations.create({ partnershipId: own, userId: candidate }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    const [task] = await client.duplicateReviews.list({ partnershipId: own });
    expect(task).toMatchObject({
      existingParticipationId: existing.id,
      candidateUserId: candidate,
      candidateEmail: email,
      status: "open",
      assignedToUserId: null,
    });
    expect(
      await client.duplicateReviews.list({ partnershipId: own }),
    ).toHaveLength(1);
    await expect(
      client.duplicateReviews.resolve({
        partnershipId: own,
        id: task!.id,
        decision: "same_person",
        survivorParticipationId: existing.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    actor = candidate;
    activeOrg = host;
    await expect(
      client.duplicateReviews.list({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.duplicateReviews.assign({ partnershipId: own, id: task!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    actor = coordinator;
    activeOrg = partner;
    await expect(
      client.duplicateReviews.list({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client.duplicateReviews.assign({ partnershipId: foreign, id: task!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await client.duplicateReviews.assign({ partnershipId: own, id: task!.id }),
    ).toMatchObject({ status: "assigned", assignedToUserId: coordinator });
    await expect(
      client.duplicateReviews.assign({ partnershipId: own, id: task!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    actor = "bccrlmqtthueqebjmltfaa3n";
    await expect(
      client.duplicateReviews.resolve({
        partnershipId: own,
        id: task!.id,
        decision: "dismiss",
        survivorParticipationId: existing.id,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "REVIEW_TASK_ASSIGNEE_REQUIRED" },
    });
    actor = coordinator;
    await expect(
      client.duplicateReviews.resolve({
        partnershipId: own,
        id: task!.id,
        decision: "same_person",
        survivorParticipationId: "wrong",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.duplicateReviews.resolve({
        partnershipId: foreign,
        id: task!.id,
        decision: "same_person",
        survivorParticipationId: existing.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await client.duplicateReviews.resolve({
        partnershipId: own,
        id: task!.id,
        decision: "same_person",
        survivorParticipationId: existing.id,
      }),
    ).toMatchObject({
      status: "resolved",
      decision: "same_person",
      survivorParticipationId: existing.id,
    });
    await expect(
      client.duplicateReviews.resolve({
        partnershipId: own,
        id: task!.id,
        decision: "dismiss",
        survivorParticipationId: existing.id,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    await client.participations.remove({ partnershipId: own, id: existing.id });
  });

  it("detects the same User even when stored email differs and records a distinct-persons decision", async () => {
    useScenario("old-email");
    const existing = { id: "tsveb7nvf5usg4bv477yeutt" };
    try {
      await expect(
        client.participations.create({ partnershipId: own, userId: candidate }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const [task] = await client.duplicateReviews.list({ partnershipId: own });
      expect(task).toMatchObject({
        existingParticipationId: existing!.id,
        candidateEmail: email,
      });
      await client.duplicateReviews.assign({ partnershipId: own, id: task!.id });
      expect(
        await client.duplicateReviews.resolve({
          partnershipId: own,
          id: task!.id,
          decision: "distinct_persons",
          survivorParticipationId: existing!.id,
        }),
      ).toMatchObject({
        decision: "distinct_persons",
        survivorParticipationId: existing!.id,
      });
    } finally {
      await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    }
  });

  it("assigns and revokes coordinators without changing membership roles", async () => {
    actor = "pht5o8jyya3mxpghmyuvllso";
    const owner = actor;
    const id = "kpdndnmev8v79jf62vod9cod";
    try {
      await client.assignments.assign({ partnershipId: own, userId: candidate });
      actor = candidate;
      activeOrg = partner;
      expect(
        (await client.participations.listPartnership({ partnershipId: own }))
          .participations,
      ).toEqual([]);
      await expect(
        client.participations.listPartnership({ partnershipId: foreign }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      actor = owner;
      await client.assignments.remove({ partnershipId: own, userId: candidate });
      actor = candidate;
      await expect(
        client.participations.listPartnership({ partnershipId: own }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (
          await db
            .select({ role: member.role })
            .from(member)
            .where(eq(member.id, id))
        )[0]?.role,
      ).toBe(ORGANIZATION_ROLES.ProjectCoordinator);
    } finally {
      actor = owner;
      activeOrg = partner;
      await db.delete(assignments).where(eq(assignments.userId, candidate));
    }
  });

  it("rejects missing onboarding, exposes own invitations only, and blocks referenced removal", async () => {
    await expect(
      client.participations.create({ partnershipId: own, userId: "unknown" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/invitation/i),
    });
    useScenario("foreign-invitation");
    const inviteId = "rethju5g600q1rp1n8atpz30";
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([]);
    await expect(
      client.participations.listPartnership({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    useScenario("own-invitation");
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([{ invitationId: inviteId, email, status: "pending" }]);
    useScenario("referenced");
    const created = { id: "ypo125qjxk231y00bi0u4fw2" };
    await expect(
      client.participations.remove({ partnershipId: own, id: created.id }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { reason: "PARTICIPATION_JOURNEY_OR_COST_REFERENCED" },
    });
    useScenario("submitted");
    const submitted = { id: "g303rlwxq17ioi7opy96382x" };
    await expect(
      client.participations.remove({ partnershipId: own, id: submitted.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      client.participations.create({ partnershipId: own, userId: candidate }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/locked/i),
    });
    await expect(
      client.participations.update({
        partnershipId: own,
        id: submitted.id,
        country: "FR",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows Participation changes while the Claim is correction_requested", async () => {
    useScenario("correction");
    const reopened = { id: "d8cqmpxlvlyjvvki4gyzl32f" };
    await expect(
      client.participations.update({
        partnershipId: own,
        id: reopened.id,
        country: "FR",
      }),
    ).resolves.toMatchObject({ country: "FR" });
    await expect(
      client.participations.remove({ partnershipId: own, id: reopened.id }),
    ).resolves.toEqual({ removed: true });
  });
});

describe("read-only Hosting Participant view", () => {
  beforeEach(() => {
    activeOrg = host;
    useScenario("report");
  });

  it("groups Participations alphabetically by represented Organization with agreement counts", async () => {
    const report = await client.participations.listHostedReport({
      projectId: project,
    });

    expect(report.organizations.map(({ country }) => country)).toEqual([
      "IT",
      "FR",
    ]);
    expect(report.agreement).toEqual({
      versionId: version.id,
      published: true,
    });
    expect(report.organizations.map((group) => group.id)).toEqual([
      other,
      partner,
    ]);
    expect(
      report.organizations.map(
        ({ name, participantCount, completedCount, pendingCount }) => ({
          name,
          participantCount,
          completedCount,
          pendingCount,
        }),
      ),
    ).toEqual([
      { name: "Other", participantCount: 1, completedCount: 0, pendingCount: 1 },
      {
        name: "Partner",
        participantCount: 2,
        completedCount: 1,
        pendingCount: 1,
      },
    ]);
    // Each Participation appears once, in its represented Organization only.
    expect(
      report.organizations.flatMap((group) =>
        group.participants.map((participant) => [
          participant.displayName,
          participant.agreement,
        ]),
      ),
    ).toEqual([
      ["Yan Outdated", "pending"],
      ["Amy Unlinked", "pending"],
      ["Zoe Current", "completed"],
    ]);
    expect(report.organizations[1].participants[1]).toMatchObject({
      country: "PT",
      email: "e7oprdkk819b6w8w68u761vp@x.org",
    });
  });

  it("reports no Organization group for a Project without Participations", async () => {
    expect(
      await client.participations.listHostedReport({ projectId: emptyProject }),
    ).toEqual({
      projectId: emptyProject,
      agreement: { versionId: version.id, published: true },
      organizations: [],
    });
  });

  it("refuses an unassigned coordinator, a Partner User and an unrelated Organization", async () => {
    actor = unassigned;
    await expect(
      client.participations.listHostedReport({ projectId: project }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    actor = coordinator;
    activeOrg = partner;
    await expect(
      client.participations.listHostedReport({ projectId: project }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    activeOrg = other;
    await expect(
      client.participations.listHostedReport({ projectId: project }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
