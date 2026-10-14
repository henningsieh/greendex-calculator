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

import {
  assignPartnerCoordinator,
  removePartnerCoordinator,
} from "@/features/projects/procedures/coordination";
import { duplicateReviews } from "@/features/projects/procedures/duplicate-reviews";
import { createParticipationProcedures } from "@/features/projects/procedures/participations";

// Stable identities registered in SEED_SCENARIOS.costTrackerParticipations.
const s = "canonical";
const host = `coord-host-${s}`;
const partner = `coord-partner-${s}`;
const other = `coord-other-${s}`;
let project: string;
let own: string;
let foreign: string;
const coordinator = `coord-actor-${s}`;
const candidate = `coord-candidate-${s}`;
const emptyProject = `coord-report-empty-project-${s}`;
const unassigned = `coord-unassigned-${s}`;
const email = `candidate-${s}@example.org`;
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
function useScenario(name: (typeof scenarioNames)[number]) {
  project = `coord-${name}-project-${s}`;
  own = `coord-${name}-own-${s}`;
  foreign = `coord-${name}-foreign-${s}`;
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
    where: eq(participants.id, `coord-correction-row-${s}`),
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
      scenarioNames.map((name) => `coord-${name}-own-${s}`),
    ),
  );
  await db
    .delete(participants)
    .where(eq(participants.projectId, `coord-empty-project-${s}`));
  await db
    .delete(assignments)
    .where(
      and(
        eq(assignments.partnershipId, `coord-empty-own-${s}`),
        eq(assignments.userId, candidate),
      ),
    );
  // Removal/update of the canonical correction Participation is behavior under test.
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
      "unverified",
      "no-profile",
      "stale",
      "wrong-role",
      "wrong-org",
    ].map((key) => `directory-${key}-${s}`);
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
      search: "capacity-",
    });
    expect(result).toHaveLength(20);
    expect(
      result.every((row) => Object.keys(row).sort().join() === "id,name"),
    ).toBe(true);
  });

  it("separates the actor's missing saved profile from current agreement acceptance", async () => {
    actor = candidate;
    activeOrg = host;
    actor = `coord-missing-agreement-${s}`;
    await expect(
      client.participations.listMine({ projectId: project }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
    });
    actor = `coord-missing-profile-${s}`;
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
      code: "BAD_REQUEST",
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
    const placeholder = { id: `coord-email-row-${s}` };
    try {
      await expect(
        client.participations.create({ partnershipId: own, userId: candidate }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
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
    const placeholder = { id: `coord-mixed-row-${s}` };
    const mixedUser = `coord-mixed-${s}`;
    try {
      await expect(
        client.participations.create({
          partnershipId: own,
          userId: mixedUser,
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
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
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    actor = `coord-second-assignee-${s}`;
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
    await client.participations.remove({ partnershipId: own, id: existing.id });
  });

  it("detects the same User even when stored email differs and records a distinct-persons decision", async () => {
    useScenario("old-email");
    const existing = { id: `coord-old-email-row-${s}` };
    try {
      await expect(
        client.participations.create({ partnershipId: own, userId: candidate }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    actor = `coord-owner-${s}`;
    const owner = actor;
    const id = `coord-candidate-partner-membership-${s}`;
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
    const inviteId = `coord-own-invitation-token-${s}`;
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
    const created = { id: `coord-referenced-row-${s}` };
    await expect(
      client.participations.remove({ partnershipId: own, id: created.id }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPATION_JOURNEY_OR_COST_REFERENCED" },
    });
    useScenario("submitted");
    const submitted = { id: `coord-submitted-row-${s}` };
    await expect(
      client.participations.remove({ partnershipId: own, id: submitted.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.participations.create({ partnershipId: own, userId: candidate }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/locked/i),
    });
    await expect(
      client.participations.update({
        partnershipId: own,
        id: submitted.id,
        country: "FR",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows Participation changes while the Claim is correction_requested", async () => {
    useScenario("correction");
    const reopened = { id: `coord-correction-row-${s}` };
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
      email: `current-${s}@x.org`,
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
