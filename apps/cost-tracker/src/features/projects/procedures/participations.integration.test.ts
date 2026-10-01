// @vitest-environment node
import { randomUUID } from "node:crypto";

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
  participantInvitationBridgesTable as bridges,
  invitation,
  participantJourneysTable as journeys,
  duplicateReviewTasksTable as reviewTasks,
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
      userId: coordinator,
      organizationId: host,
      role: "project-coordinator",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: candidate,
      organizationId: host,
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
  await db
    .insert(hostAssignments)
    .values({ projectId: project, userId: coordinator });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
  ]);
  await db
    .insert(assignments)
    .values({ partnershipId: own, userId: coordinator });
  await db.insert(profiles).values({ userId: candidate, fullName: "Candidate" });
  await db.insert(acceptances).values({
    userId: candidate,
    version: version.id,
    contentHash: version.contentHash,
    answers: '{"accepted":true}',
  });
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(() => {
  actor = coordinator;
  activeOrg = partner;
});

afterAll(async () => {
  await db.delete(reviewTasks).where(eq(reviewTasks.partnershipId, own));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(bridges).where(eq(bridges.projectId, project));
  await db.delete(invitation).where(eq(invitation.organizationId, host));
  await db.delete(acceptances).where(eq(acceptances.userId, candidate));
  await db.delete(profiles).where(eq(profiles.userId, candidate));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(member).where(eq(member.organizationId, partner));
  await db.delete(member).where(eq(member.organizationId, host));
  await db.delete(organization).where(eq(organization.id, other));
  await db.delete(organization).where(eq(organization.id, partner));
  await db.delete(organization).where(eq(organization.id, host));
  await db.delete(user).where(eq(user.id, candidate));
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
      code: "FORBIDDEN",
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
        role: "participant",
      },
      {
        key: "no-profile",
        verified: true,
        profile: false,
        accepted: true,
        org: host,
        role: "participant",
      },
      {
        key: "stale",
        verified: true,
        profile: true,
        accepted: false,
        org: host,
        role: "participant",
      },
      {
        key: "wrong-role",
        verified: true,
        profile: true,
        accepted: true,
        org: host,
        role: "member",
      },
      {
        key: "wrong-org",
        verified: true,
        profile: true,
        accepted: true,
        org: other,
        role: "participant",
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
          role: "participant",
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.participations.listPartnership({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.participations.update({
        partnershipId: foreign,
        id: created.id,
        country: "FR",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.participations.remove({ partnershipId: foreign, id: created.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      role: "participant",
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.duplicateReviews.assign({ partnershipId: foreign, id: task!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      role: "project-coordinator",
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
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      role: "project-coordinator",
      createdAt: new Date(),
    });
    await db
      .update(member)
      .set({ role: "owner" })
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
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      ).toBe("project-coordinator");
    } finally {
      actor = coordinator;
      activeOrg = partner;
      await db.delete(assignments).where(eq(assignments.userId, candidate));
      await db.delete(member).where(eq(member.id, id));
      await db
        .update(member)
        .set({ role: "project-coordinator" })
        .where(eq(member.userId, coordinator));
    }
  });

  it("rejects missing onboarding, exposes own bridge only, and blocks referenced removal", async () => {
    await expect(
      client.participations.create({ partnershipId: own, userId: "unknown" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/invitation/i),
    });
    const inviteId = randomUUID();
    await db.insert(invitation).values({
      id: inviteId,
      organizationId: host,
      email,
      role: "participant",
      status: "pending",
      expiresAt: new Date(Date.now() + 86400000),
      inviterId: coordinator,
    });
    await db.insert(bridges).values({
      invitationId: inviteId,
      projectId: project,
      partnershipId: foreign,
      email,
      issuedByUserId: coordinator,
    });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([]);
    await expect(
      client.participations.listPartnership({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.delete(bridges).where(eq(bridges.invitationId, inviteId));
    await db.insert(bridges).values({
      invitationId: inviteId,
      projectId: project,
      partnershipId: own,
      email,
      issuedByUserId: coordinator,
    });
    expect(
      (await client.participations.listPartnership({ partnershipId: own }))
        .invitations,
    ).toEqual([{ invitationId: inviteId, email, status: "pending" }]);
    await db.delete(bridges).where(eq(bridges.invitationId, inviteId));
    await db.delete(invitation).where(eq(invitation.id, inviteId));
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
