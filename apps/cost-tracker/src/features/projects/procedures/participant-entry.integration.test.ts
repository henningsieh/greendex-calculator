// @vitest-environment node

import { randomUUID } from "node:crypto";

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";
import { evaluateProjectScopeAccess } from "@greendex/auth/project-authorization";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  participantEntryTokensTable as entryTokens,
  projectParticipantsTable as participants,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
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

const delivery = vi.hoisted(() => ({
  sendParticipantInvitation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  sendParticipantInvitation: delivery.sendParticipantInvitation,
}));

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { createParticipantOnboardingProcedures } from "@/features/authentication/participant-onboarding-procedures";
import { createParticipationProcedures } from "@/features/projects/procedures/participations";

const suffix = randomUUID();
const host = `entry-host-${suffix}`;
const partner = `entry-partner-${suffix}`;
const otherPartner = `entry-other-${suffix}`;
const project = `entry-project-${suffix}`;
const partnership = `entry-partnership-${suffix}`;
const owner = `entry-owner-${suffix}`;
const organizer = `entry-organizer-${suffix}`;
let actor = owner;
let activeOrganizationId: string | null = partner;

const client = createRouterClient(
  {
    participantOnboarding: createParticipantOnboardingProcedures(() => ({
      id: "fixture-agreement-v1",
      contentHash: "fixture-hash-v1",
    })),
    participations: createParticipationProcedures(() => ({
      id: "fixture-agreement-v1",
      contentHash: "fixture-hash-v1",
    })),
  },
  { context: async () => ({ headers: new Headers() }) },
);

/** Stands in for Better Auth's supported server check against active state. */
async function hasPermission(
  permissions: Record<string, string[]>,
): Promise<boolean> {
  if (!activeOrganizationId) throw new Error("NO_ACTIVE_ORGANIZATION");
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, actor),
        eq(member.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);
  const role = membership?.role;
  if (!role) throw new Error("USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION");
  return parseOrganizationRoles(role).some(
    (name) =>
      name in costTrackerOrganizationRoles &&
      costTrackerOrganizationRoles[
        name as keyof typeof costTrackerOrganizationRoles
      ].authorize(permissions as never).success,
  );
}

/** What the browser would evaluate for the same state the server enforces. */
async function clientDecision() {
  const [membership] = activeOrganizationId
    ? await db
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.userId, actor),
            eq(member.organizationId, activeOrganizationId),
          ),
        )
        .limit(1)
    : [];
  const [assignment] = await db
    .select({ userId: assignments.userId })
    .from(assignments)
    .where(
      and(
        eq(assignments.partnershipId, partnership),
        eq(assignments.userId, actor),
      ),
    )
    .limit(1);
  return evaluateProjectScopeAccess({
    role: membership?.role ?? null,
    activeOrganizationId,
    partnerOrganizationId: partner,
    hostOrganizationId: host,
    assignedCoordinator: Boolean(assignment),
    mayCreateParticipation: membership?.role
      ? hasOrganizationPermission(membership.role)
      : false,
  });
}

function hasOrganizationPermission(role: string): boolean {
  return parseOrganizationRoles(role).some(
    (name) =>
      name in costTrackerOrganizationRoles &&
      costTrackerOrganizationRoles[
        name as keyof typeof costTrackerOrganizationRoles
      ].authorize({ projectParticipation: ["create"] }).success,
  );
}

async function setActorRole(organizationId: string, role: string) {
  await db
    .update(member)
    .set({ role })
    .where(
      and(eq(member.userId, actor), eq(member.organizationId, organizationId)),
    );
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: owner,
      name: "Owner",
      email: `entry-owner-${suffix}@example.org`,
      emailVerified: true,
    },
    {
      id: organizer,
      name: "Organizer",
      email: `entry-organizer-${suffix}@example.org`,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values([
    { id: host, name: "Entry Host", slug: host, createdAt: now },
    { id: partner, name: "Entry Partner", slug: partner, createdAt: now },
    { id: otherPartner, name: "Entry Other", slug: otherPartner, createdAt: now },
  ]);
  await db.insert(projects).values({
    id: project,
    name: "Entry Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: host,
  });
  await db.insert(partnerships).values({
    id: partnership,
    projectId: project,
    organizationId: partner,
  });
  await db.insert(member).values([
    {
      id: randomUUID(),
      organizationId: partner,
      userId: owner,
      role: "owner",
      createdAt: now,
    },
    {
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: "owner",
      createdAt: now,
    },
    {
      id: randomUUID(),
      organizationId: partner,
      userId: organizer,
      role: "project-coordinator",
      createdAt: now,
    },
  ]);
  await db.insert(hostAssignments).values({
    projectId: project,
    userId: organizer,
  });
});

beforeEach(async () => {
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(assignments).where(eq(assignments.partnershipId, partnership));
  await db.delete(participants).where(eq(participants.projectId, project));
  actor = owner;
  activeOrganizationId = partner;
  vi.clearAllMocks();
  delivery.sendParticipantInvitation.mockResolvedValue(undefined);
  authMocks.getSession.mockImplementation(async () => ({
    user: {
      id: actor,
      name: actor === owner ? "Owner" : "Organizer",
      email: `${actor}-${suffix}@example.org`,
      emailVerified: true,
    },
    session: { id: randomUUID(), activeOrganizationId },
  }));
  authMocks.hasPermission.mockImplementation(
    async ({ body }: { body: { permissions: Record<string, string[]> } }) => ({
      success: await hasPermission(body.permissions),
    }),
  );
});

afterAll(async () => {
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(assignments).where(eq(assignments.partnershipId, partnership));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(hostAssignments).where(eq(hostAssignments.projectId, project));
  await db.delete(partnerships).where(eq(partnerships.id, partnership));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(member).where(eq(member.userId, owner));
  await db.delete(member).where(eq(member.userId, organizer));
  await db.delete(organization).where(eq(organization.id, partner));
  await db.delete(organization).where(eq(organization.id, otherPartner));
  await db.delete(organization).where(eq(organization.id, host));
  await db.delete(user).where(eq(user.id, owner));
  await db.delete(user).where(eq(user.id, organizer));
});

describe("Project-scope participant entry authorization", () => {
  it.each([
    { role: "owner", permitted: true },
    { role: "admin", permitted: true },
    { role: "owner,participant", permitted: true },
    { role: "participant", permitted: false },
    { role: "project-coordinator", permitted: false },
  ])(
    "enforces the shared policy for a Partner Organization $role",
    async ({ role, permitted }) => {
      await setActorRole(partner, role);
      try {
        if (permitted)
          await expect(
            client.participantOnboarding.createRegistrationLink({
              partnershipId: partnership,
            }),
          ).resolves.toEqual({
            id: expect.any(String),
            secret: expect.any(String),
          });
        else
          await expect(
            client.participantOnboarding.createRegistrationLink({
              partnershipId: partnership,
            }),
          ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect((await clientDecision()).permitted).toBe(permitted);
      } finally {
        await setActorRole(partner, "owner");
      }
    },
  );

  it("permits an assigned Partner Group Organizer and refuses the same role without an assignment", async () => {
    actor = organizer;
    await db
      .insert(assignments)
      .values({ partnershipId: partnership, userId: organizer });
    try {
      await expect(
        client.participantOnboarding.issueInvitation({
          partnershipId: partnership,
          email: `assigned-${suffix}@example.org`,
        }),
      ).resolves.toMatchObject({ delivery: "sent" });
      expect(await clientDecision()).toEqual({ permitted: true });
    } finally {
      await db
        .delete(assignments)
        .where(eq(assignments.partnershipId, partnership));
      await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
    }
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: `unassigned-${suffix}@example.org`,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_COORDINATION_REQUIRED" },
    });
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "ASSIGNMENT_MISSING",
    });
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(0);
  });

  it("refuses a stale client decision after the assignment is revoked", async () => {
    actor = organizer;
    await db
      .insert(assignments)
      .values({ partnershipId: partnership, userId: organizer });
    expect(await clientDecision()).toEqual({ permitted: true });
    await db
      .delete(assignments)
      .where(eq(assignments.partnershipId, partnership));
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "ASSIGNMENT_MISSING",
    });
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: `stale-${suffix}@example.org`,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
  });

  it("refuses Hosting staff and unrelated Organizations without disclosing the Partnership", async () => {
    actor = organizer;
    activeOrganizationId = host;
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "HOSTING_SIDE",
    });
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: `host-${suffix}@example.org`,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_ENTRY_REQUIRED" },
    });
    activeOrganizationId = otherPartner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: `other-${suffix}@example.org`,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(0);
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
  });

  it("fails closed without an active Organization on every entry operation", async () => {
    actor = owner;
    activeOrganizationId = partner;
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    const invitation = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: `fail-closed-${suffix}@example.org`,
    });
    activeOrganizationId = null;
    for (const attempt of [
      () =>
        client.participantOnboarding.issueInvitation({
          partnershipId: partnership,
          email: `fail-closed-2-${suffix}@example.org`,
        }),
      () =>
        client.participantOnboarding.reissueInvitation({
          partnershipId: partnership,
          email: `fail-closed-${suffix}@example.org`,
        }),
      () =>
        client.participantOnboarding.createRegistrationLink({
          partnershipId: partnership,
        }),
      () =>
        client.participantOnboarding.setRegistrationLinkOpen({
          id: link.id,
          open: false,
        }),
      () =>
        client.participantOnboarding.setInvitationOpen({
          invitationId: invitation.invitationId,
          open: false,
        }),
    ])
      await expect(attempt()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
      });
  });

  it("reports the same non-secret context the browser evaluates the policy with", async () => {
    actor = owner;
    const context = (
      await client.participations.listPartnership({ partnershipId: partnership })
    ).entryContext;
    expect(context).toEqual({
      partnerOrganizationId: partner,
      hostOrganizationId: host,
      assignedCoordinator: false,
    });
    expect(await clientDecision()).toEqual({ permitted: true });
    actor = organizer;
    await db
      .insert(assignments)
      .values({ partnershipId: partnership, userId: organizer });
    expect(
      (
        await client.participations.listPartnership({
          partnershipId: partnership,
        })
      ).entryContext.assignedCoordinator,
    ).toBe(true);
  });
});

describe("Participant details authorization", () => {
  /** One Partner-represented Project Participation to read and correct. */
  async function seedParticipation() {
    const [row] = await db
      .insert(participants)
      .values({
        projectId: project,
        representedOrganizationId: partner,
        displayName: "Joining Participant",
        email: `joining-${suffix}@example.org`,
      })
      .returning({ id: participants.id });
    if (!row) throw new Error("PARTICIPATION_FIXTURE_MISSING");
    return row.id;
  }

  it.each(["owner", "admin"])(
    "serves a Partner Organization %s the details and lets them correct country",
    async (role) => {
      const id = await seedParticipation();
      await setActorRole(partner, role);
      try {
        expect(
          await client.participations.get({
            partnershipId: partnership,
            id,
          }),
        ).toMatchObject({
          projectId: project,
          projectName: "Entry Project",
          participation: { id, displayName: "Joining Participant" },
          correctionContext: {
            partnerOrganizationId: partner,
            hostOrganizationId: host,
            assignedCoordinator: false,
          },
        });
        expect(await clientDecision()).toEqual({ permitted: true });
        await expect(
          client.participations.update({
            partnershipId: partnership,
            id,
            country: "DE",
          }),
        ).resolves.toMatchObject({ country: "DE" });
      } finally {
        await setActorRole(partner, "owner");
      }
    },
  );

  it("reads to Hosting staff but refuses their correction of country", async () => {
    const id = await seedParticipation();
    activeOrganizationId = host;
    expect(
      await client.participations.get({ partnershipId: partnership, id }),
    ).toMatchObject({
      correctionContext: {
        partnerOrganizationId: partner,
        hostOrganizationId: host,
        // Hosting staff carry no Group Organizer assignment on the Partner side.
        assignedCoordinator: false,
      },
    });
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "HOSTING_SIDE",
    });
    await expect(
      client.participations.update({
        partnershipId: partnership,
        id,
        country: "DE",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_PARTICIPATION_UPDATE_REQUIRED" },
    });
    await expect(
      client.participations.remove({ partnershipId: partnership, id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const [unchanged] = await db
      .select({ country: participants.country })
      .from(participants)
      .where(eq(participants.id, id));
    expect(unchanged).toEqual({ country: null });
  });

  it("corrects country for an assigned Partner Group Organizer and refuses the unassigned one", async () => {
    const id = await seedParticipation();
    actor = organizer;
    await expect(
      client.participations.update({
        partnershipId: partnership,
        id,
        country: "DE",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_COORDINATION_REQUIRED" },
    });
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "ASSIGNMENT_MISSING",
    });
    await db
      .insert(assignments)
      .values({ partnershipId: partnership, userId: organizer });
    try {
      expect(
        await client.participations.get({ partnershipId: partnership, id }),
      ).toMatchObject({
        correctionContext: { assignedCoordinator: true },
      });
      expect(await clientDecision()).toEqual({ permitted: true });
      await expect(
        client.participations.update({
          partnershipId: partnership,
          id,
          country: "DE",
        }),
      ).resolves.toMatchObject({ country: "DE" });
    } finally {
      await db
        .delete(assignments)
        .where(eq(assignments.partnershipId, partnership));
    }
  });

  it("hides the details from an unrelated Organization", async () => {
    const id = await seedParticipation();
    activeOrganizationId = otherPartner;
    for (const attempt of [
      () => client.participations.get({ partnershipId: partnership, id }),
      () =>
        client.participations.update({
          partnershipId: partnership,
          id,
          country: "DE",
        }),
      () => client.participations.remove({ partnershipId: partnership, id }),
    ])
      await expect(attempt()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a country outside the EU set without changing the stored value", async () => {
    const id = await seedParticipation();
    await expect(
      client.participations.update({
        partnershipId: partnership,
        id,
        // @ts-expect-error -- proves the declared EU set, not a free-text country.
        country: "CH",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await client.participations.get({ partnershipId: partnership, id }))
        .participation.country,
    ).toBeNull();
  });

  it("fails closed on the details read and correction without an active Organization", async () => {
    const id = await seedParticipation();
    activeOrganizationId = null;
    expect(await clientDecision()).toEqual({
      permitted: false,
      reason: "MISSING_ACTIVE_ORGANIZATION",
    });
    for (const attempt of [
      () => client.participations.get({ partnershipId: partnership, id }),
      () =>
        client.participations.update({
          partnershipId: partnership,
          id,
          country: "DE",
        }),
    ])
      await expect(attempt()).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
      });
  });

  it("removes a confirmed Project Participation from the Partner side only", async () => {
    const id = await seedParticipation();
    await client.participations.remove({ partnershipId: partnership, id });
    expect(
      await db
        .select({ id: participants.id })
        .from(participants)
        .where(eq(participants.id, id)),
    ).toEqual([]);
    await expect(
      client.participations.get({ partnershipId: partnership, id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
