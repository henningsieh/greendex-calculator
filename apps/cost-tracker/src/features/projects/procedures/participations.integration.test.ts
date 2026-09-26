// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
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
      role: "member",
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: host,
      role: "member",
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
    responsibleUserId: coordinator,
  });
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
    } finally {
      await db.delete(participants).where(eq(participants.id, placeholder!.id));
    }
  });

  it("assigns and revokes coordinators without changing membership roles", async () => {
    const id = randomUUID();
    await db.insert(member).values({
      id,
      userId: candidate,
      organizationId: partner,
      role: "member",
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
      ).toBe("member");
    } finally {
      actor = coordinator;
      activeOrg = partner;
      await db.delete(assignments).where(eq(assignments.userId, candidate));
      await db.delete(member).where(eq(member.id, id));
      await db
        .update(member)
        .set({ role: "member" })
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
