import { randomUUID } from "node:crypto";

// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  member,
  organization,
  user,
  projectsTable as projects,
  projectPartnerOrganizationsTable as partnerships,
  partnerCoordinatorAssignmentsTable as assignments,
  participantProfilesTable as profiles,
  participantAgreementAcceptancesTable as acceptances,
  projectParticipantsTable as participants,
  participantEntryTokensTable as entryTokens,
  participantJourneysTable as journeys,
  duplicateReviewTasksTable as reviewTasks,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  afterAll,
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

const s = randomUUID();
const host = `coord-host-${s}`;
const partner = `coord-partner-${s}`;
const other = `coord-other-${s}`;
const project = `coord-project-${s}`;
const own = `coord-own-${s}`;
const foreign = `coord-foreign-${s}`;
const coordinator = `coord-actor-${s}`;
const candidate = `coord-candidate-${s}`;
const emptyProject = `coord-empty-project-${s}`;
const unassigned = `coord-unassigned-${s}`;
const currentAcceptor = `coord-current-${s}`;
const oldAcceptor = `coord-old-${s}`;
const unjoined = `coord-unjoined-${s}`;
const email = `candidate-${s}@example.org`;
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
  const now = new Date();
  await db.insert(user).values([
    {
      id: coordinator,
      name: "Coordinator",
      email: `coordinator-${s}@example.org`,
      emailVerified: true,
    },
    { id: candidate, name: "Candidate", email, emailVerified: true },
    { id: unassigned, name: "Unassigned", email: `unassigned-${s}@x.org` },
    { id: currentAcceptor, name: "Current", email: `current-${s}@x.org` },
    { id: oldAcceptor, name: "Old", email: `old-${s}@x.org` },
  ]);
  await db.insert(organization).values([
    { country: "DE", id: host, name: "Host", slug: host, createdAt: now },
    {
      country: "FR",
      id: partner,
      name: "Partner",
      slug: partner,
      createdAt: now,
    },
    { country: "IT", id: other, name: "Other", slug: other, createdAt: now },
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
      userId: coordinator,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: candidate,
      organizationId: host,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: unassigned,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
  ]);
  await db.insert(projects).values([
    {
      id: project,
      name: "Project",
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV",
      organizationId: host,
    },
    {
      id: emptyProject,
      name: "Empty Project",
      startDate: now,
      endDate: now,
      location: "Vilnius",
      country: "LT",
      organizationId: host,
    },
  ]);
  await db.insert(hostAssignments).values([
    { projectId: project, userId: coordinator },
    { projectId: emptyProject, userId: coordinator },
  ]);
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
  ]);
  await db
    .insert(assignments)
    .values({ partnershipId: own, userId: coordinator });
  await db.insert(profiles).values({ userId: candidate, fullName: "Candidate" });
  await db.insert(acceptances).values([
    {
      userId: candidate,
      version: version.id,
      contentHash: version.contentHash,
      answers: '{"accepted":true}',
    },
    // Only the current required version completes the agreement; an older
    // acceptance is historical evidence, not completion.
    {
      userId: currentAcceptor,
      version: version.id,
      contentHash: version.contentHash,
      answers: '{"accepted":true}',
    },
    {
      userId: oldAcceptor,
      version: "fixture-v0",
      contentHash: "fixture-old-hash",
      answers: '{"accepted":true}',
    },
  ]);
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(() => {
  actor = coordinator;
  activeOrg = partner;
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

afterAll(async () => {
  await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db
    .delete(acceptances)
    .where(
      inArray(acceptances.userId, [candidate, currentAcceptor, oldAcceptor]),
    );
  await db.delete(profiles).where(eq(profiles.userId, candidate));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db
    .delete(hostAssignments)
    .where(eq(hostAssignments.projectId, emptyProject));
  await db.delete(projects).where(eq(projects.id, emptyProject));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(member).where(eq(member.organizationId, partner));
  await db.delete(member).where(eq(member.organizationId, host));
  await db.delete(organization).where(eq(organization.id, other));
  await db.delete(organization).where(eq(organization.id, partner));
  await db.delete(organization).where(eq(organization.id, host));
  await db
    .delete(user)
    .where(
      inArray(user.id, [candidate, unassigned, currentAcceptor, oldAcceptor]),
    );
  await db.delete(user).where(eq(user.id, coordinator));
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
    const cases = [
      {
        key: "unverified",
        verified: false,
        profile: true,
        accepted: true,
        org: host,
        role: ORGANIZATION_ROLES.Participant,
      },
      {
        key: "no-profile",
        verified: true,
        profile: false,
        accepted: true,
        org: host,
        role: ORGANIZATION_ROLES.Participant,
      },
      {
        key: "stale",
        verified: true,
        profile: true,
        accepted: false,
        org: host,
        role: ORGANIZATION_ROLES.Participant,
      },
      {
        key: "wrong-role",
        verified: true,
        profile: true,
        accepted: true,
        org: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
      },
      {
        key: "wrong-org",
        verified: true,
        profile: true,
        accepted: true,
        org: other,
        role: ORGANIZATION_ROLES.Participant,
      },
    ];
    const ids = cases.map(({ key }) => `directory-${key}-${s}`);
    try {
      await db.insert(user).values(
        cases.map(({ key, verified }, index) => ({
          id: ids[index]!,
          name: "Directory Candidate",
          email: `directory-${key}-${s}@example.org`,
          emailVerified: verified,
        })),
      );
      await db.insert(member).values(
        cases.map(({ org, role }, index) => ({
          id: randomUUID(),
          organizationId: org,
          userId: ids[index]!,
          role,
          createdAt: new Date(),
        })),
      );
      await db
        .insert(profiles)
        .values(
          cases.flatMap(({ profile }, index) =>
            profile
              ? [{ userId: ids[index]!, fullName: "Directory Candidate" }]
              : [],
          ),
        );
      await db.insert(acceptances).values(
        cases.flatMap(({ accepted }, index) =>
          accepted
            ? [
                {
                  userId: ids[index]!,
                  version: version.id,
                  contentHash: version.contentHash,
                  answers: '{"accepted":true}',
                },
              ]
            : [],
        ),
      );
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
    } finally {
      for (const id of ids) {
        await db.delete(acceptances).where(eq(acceptances.userId, id));
        await db.delete(profiles).where(eq(profiles.userId, id));
        await db.delete(member).where(eq(member.userId, id));
        await db.delete(user).where(eq(user.id, id));
      }
    }
  });

  it("caps directory results at 20 minimal rows", async () => {
    const ids = Array.from(
      { length: 22 },
      (_, index) => `directory-cap-${index}-${s}`,
    );
    try {
      await db.insert(user).values(
        ids.map((id) => ({
          id,
          name: "Cap User",
          email: `${id}@example.org`,
          emailVerified: true,
        })),
      );
      await db.insert(member).values(
        ids.map((id) => ({
          id: randomUUID(),
          userId: id,
          organizationId: host,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: new Date(),
        })),
      );
      await db
        .insert(profiles)
        .values(ids.map((id) => ({ userId: id, fullName: "Cap Candidate" })));
      await db.insert(acceptances).values(
        ids.map((id) => ({
          userId: id,
          version: version.id,
          contentHash: version.contentHash,
          answers: '{"accepted":true}',
        })),
      );
      const result = await client.participations.searchOnboarded({
        partnershipId: own,
        search: "directory-cap-",
      });
      expect(result).toHaveLength(20);
      expect(
        result.every((row) => Object.keys(row).sort().join() === "id,name"),
      ).toBe(true);
    } finally {
      for (const id of ids) {
        await db.delete(acceptances).where(eq(acceptances.userId, id));
        await db.delete(profiles).where(eq(profiles.userId, id));
        await db.delete(member).where(eq(member.userId, id));
        await db.delete(user).where(eq(user.id, id));
      }
    }
  });

  it("separates the actor's missing saved profile from current agreement acceptance", async () => {
    actor = candidate;
    activeOrg = host;
    await db.delete(acceptances).where(eq(acceptances.userId, candidate));
    try {
      await expect(
        client.participations.listMine({ projectId: project }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
        data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
      });
      await db.delete(profiles).where(eq(profiles.userId, candidate));
      await expect(
        client.participations.listMine({ projectId: project }),
      ).rejects.toMatchObject({
        code: "UNPROCESSABLE_CONTENT",
        status: 422,
        data: { reason: "PARTICIPANT_PROFILE_REQUIRED" },
      });
    } finally {
      await db
        .insert(profiles)
        .values({ userId: candidate, fullName: "Candidate" })
        .onConflictDoNothing();
      await db
        .insert(acceptances)
        .values({
          userId: candidate,
          version: version.id,
          contentHash: version.contentHash,
          answers: '{"accepted":true}',
        })
        .onConflictDoNothing();
    }
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
    ).toBe("Project");
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
    const [placeholder] = await db
      .insert(participants)
      .values({
        projectId: project,
        representedOrganizationId: other,
        displayName: "Existing",
        email,
      })
      .returning({ id: participants.id });
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
      await db.delete(participants).where(eq(participants.id, placeholder!.id));
    }
  });

  it("detects the same email across case variants via normalization", async () => {
    const mixedUser = `coord-mixed-${s}`;
    const mixedEmail = `MIXED-${s}@EXAMPLE.ORG`;
    await db.insert(user).values({
      id: mixedUser,
      name: "Mixed",
      email: mixedEmail,
      emailVerified: true,
    });
    await db.insert(member).values({
      id: randomUUID(),
      userId: mixedUser,
      organizationId: host,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: new Date(),
    });
    await db.insert(profiles).values({ userId: mixedUser, fullName: "Mixed" });
    await db.insert(acceptances).values({
      userId: mixedUser,
      version: version.id,
      contentHash: version.contentHash,
      answers: '{"accepted":true}',
    });
    const [placeholder] = await db
      .insert(participants)
      .values({
        projectId: project,
        representedOrganizationId: other,
        displayName: "Existing",
        email: mixedEmail.toLowerCase(),
      })
      .returning({ id: participants.id });
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
      await db.delete(participants).where(eq(participants.id, placeholder!.id));
      await db.delete(profiles).where(eq(profiles.userId, mixedUser));
      await db.delete(acceptances).where(eq(acceptances.userId, mixedUser));
      await db.delete(member).where(eq(member.userId, mixedUser));
      await db.delete(user).where(eq(user.id, mixedUser));
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
    const secondMembershipId = randomUUID();
    await db.insert(member).values({
      id: secondMembershipId,
      userId: candidate,
      organizationId: partner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
    await db
      .insert(assignments)
      .values({ partnershipId: own, userId: candidate });
    try {
      actor = candidate;
      await expect(
        client.duplicateReviews.resolve({
          partnershipId: own,
          id: task!.id,
          decision: "dismiss",
          survivorParticipationId: existing.id,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
        data: { reason: "REVIEW_TASK_ASSIGNEE_REQUIRED" },
      });
    } finally {
      actor = coordinator;
      await db.delete(assignments).where(eq(assignments.userId, candidate));
      await db.delete(member).where(eq(member.id, secondMembershipId));
    }
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
    const [existing] = await db
      .insert(participants)
      .values({
        projectId: project,
        representedOrganizationId: other,
        displayName: "Earlier email",
        userId: candidate,
        email: `old-${s}@example.org`,
      })
      .returning({ id: participants.id });
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
      await db.delete(participants).where(eq(participants.id, existing!.id));
    }
  });

  it("assigns and revokes coordinators without changing membership roles", async () => {
    const id = randomUUID();
    await db.insert(member).values({
      id,
      userId: candidate,
      organizationId: partner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
      .where(eq(member.userId, coordinator));
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
      actor = coordinator;
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
      actor = coordinator;
      activeOrg = partner;
      await db.delete(assignments).where(eq(assignments.userId, candidate));
      await db.delete(member).where(eq(member.id, id));
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
        .where(eq(member.userId, coordinator));
    }
  });

  it("rejects missing onboarding, exposes own invitations only, and blocks referenced removal", async () => {
    await expect(
      client.participations.create({ partnershipId: own, userId: "unknown" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/invitation/i),
    });
    const inviteId = randomUUID();
    await db.insert(entryTokens).values({
      id: inviteId,
      projectId: project,
      partnershipId: foreign,
      email,
      secretHash: "fixture-secret-hash",
      expiresAt: new Date(Date.now() + 86400000),
      issuedByUserId: coordinator,
    });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([]);
    await expect(
      client.participations.listPartnership({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.delete(entryTokens).where(eq(entryTokens.id, inviteId));
    await db.insert(entryTokens).values({
      id: inviteId,
      projectId: project,
      partnershipId: own,
      email,
      secretHash: "fixture-secret-hash",
      expiresAt: new Date(Date.now() + 86400000),
      issuedByUserId: coordinator,
    });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([{ invitationId: inviteId, email, status: "pending" }]);
    await db.delete(entryTokens).where(eq(entryTokens.id, inviteId));
    const created = await client.participations.create({
      partnershipId: own,
      userId: candidate,
    });
    await db.insert(journeys).values({
      id: candidate,
      projectParticipantId: created.id,
      origin: "Riga",
      destination: "Berlin",
      tripType: "one-way",
      erasmusDistanceKm: "100.00",
    });
    await expect(
      client.participations.remove({ partnershipId: own, id: created.id }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "PARTICIPATION_JOURNEY_OR_COST_REFERENCED" },
    });
    await db.delete(journeys).where(eq(journeys.id, candidate));
    const [claim] = await db
      .insert(claims)
      .values({ partnershipId: own, status: "submitted" })
      .returning({ id: claims.id });
    await expect(
      client.participations.remove({ partnershipId: own, id: created.id }),
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
        id: created.id,
        country: "FR",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await db.delete(claims).where(eq(claims.id, claim!.id));
    await client.participations.remove({ partnershipId: own, id: created.id });
  });

  it("allows Participation changes while the Claim is correction_requested", async () => {
    const reopened = await client.participations.create({
      partnershipId: own,
      userId: candidate,
    });
    const [claim] = await db
      .insert(claims)
      .values({ partnershipId: own, status: "correction_requested" })
      .returning({ id: claims.id });
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
    await db.delete(claims).where(eq(claims.id, claim!.id));
  });
});

describe("read-only Hosting Participant report", () => {
  const reportRows = async () =>
    db
      .insert(participants)
      .values([
        {
          id: unjoined,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Amy Unlinked",
          email: `amy-${s}@example.org`,
        },
        {
          id: `coord-current-row-${s}`,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Zoe Current",
          userId: currentAcceptor,
          email: `current-${s}@x.org`,
          country: "PT",
        },
        {
          id: `coord-old-row-${s}`,
          projectId: project,
          representedOrganizationId: other,
          displayName: "Yan Outdated",
          userId: oldAcceptor,
          email: `old-${s}@x.org`,
        },
      ])
      .returning({ id: participants.id });

  beforeEach(async () => {
    activeOrg = host;
    await reportRows();
  });

  afterEach(async () => {
    await db.delete(participants).where(eq(participants.projectId, project));
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
