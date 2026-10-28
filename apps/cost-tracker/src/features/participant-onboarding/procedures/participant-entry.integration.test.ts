// @vitest-environment node

import { randomUUID } from "node:crypto";

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";
import { evaluateProjectScopeAccess } from "@greendex/auth/project-authorization";
import { db } from "@greendex/database";
import {
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  participantEntryTokensTable as entryTokens,
  projectParticipantsTable as participants,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq } from "drizzle-orm";
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

import { createParticipantOnboardingProcedures } from "@/features/participant-onboarding/procedures/participant-onboarding";
import { createParticipationProcedures } from "@/features/participations/procedures/core";

/**
 * Canonical seed identities (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). This file owns the Sustainability
 * Conference Project plus its Partnership to the second Partner Organization.
 * Issuance goes through the procedures under test. Details reads/corrections
 * use the seeded Participation; every case restores that record and the
 * canonical assignment, and removes its issued tokens. The primary Partner Organization is the
 * unrelated scope; Hosting reads use the seed Hosting Organization.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_SLUG = "seed-second-partner-org";
const SEED_UNRELATED_SLUG = "seed-partner-org";
const SEED_ENTRY_PROJECT_NAME = "Sustainability Conference";
const SEED_OWNER_EMAIL = "owner@sieh.org";
const SEED_ADMIN_EMAIL = "seed-admin@example.org";
const SEED_COORDINATOR_EMAIL = "seed-coordinator@example.org";
const SEED_PARTICIPANT_EMAIL = "seed-participant@example.org";
const SEED_HYBRID_ADMIN_EMAIL = "seed-hybrid-admin@example.org";
const suffix = randomUUID();
let host = "";
let partner = "";
let otherPartner = "";
let project = "";
let partnership = "";
let owner = "";
let organizer = "";
let adminUserId = "";
let hybridAdminUserId = "";
let participantUserId = "";
let actor = "";
let baselineParticipation: typeof participants.$inferSelect;
let baselineAssignment: typeof assignments.$inferSelect;
let activeOrganizationId: string | null = null;

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

async function actorEmailFor(userId: string): Promise<string> {
  const stored = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });
  if (!stored) throw new Error(`Seed user is missing: ${userId}`);
  return stored.email;
}

beforeAll(async () => {
  const seedHost = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_ORG_SLUG),
  });
  if (!seedHost)
    throw new Error("Canonical seed Hosting Organization is missing");
  const seedPartner = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_PARTNER_SLUG),
  });
  if (!seedPartner)
    throw new Error("Canonical seed Partner Organization is missing");
  const seedSecond = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_UNRELATED_SLUG),
  });
  if (!seedSecond) throw new Error("Canonical unrelated Organization is missing");
  const seedProject = await db.query.projectsTable.findFirst({
    where: and(
      eq(projectsTable.organizationId, seedHost.id),
      eq(projectsTable.name, SEED_ENTRY_PROJECT_NAME),
    ),
  });
  if (!seedProject) throw new Error("Canonical entry Project is missing");
  const seedPartnership =
    await db.query.projectPartnerOrganizationsTable.findFirst({
      where: and(
        eq(partnerships.projectId, seedProject.id),
        eq(partnerships.organizationId, seedPartner.id),
      ),
    });
  if (!seedPartnership) throw new Error("Canonical entry Partnership is missing");
  async function userIdFor(email: string): Promise<string> {
    const stored = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (!stored) throw new Error(`Canonical seed User is missing: ${email}`);
    return stored.id;
  }
  host = seedHost.id;
  partner = seedPartner.id;
  otherPartner = seedSecond.id;
  project = seedProject.id;
  partnership = seedPartnership.id;
  owner = await userIdFor(SEED_OWNER_EMAIL);
  organizer = await userIdFor(SEED_COORDINATOR_EMAIL);
  adminUserId = await userIdFor(SEED_ADMIN_EMAIL);
  hybridAdminUserId = await userIdFor(SEED_HYBRID_ADMIN_EMAIL);
  participantUserId = await userIdFor(SEED_PARTICIPANT_EMAIL);
  actor = owner;
  activeOrganizationId = partner;
  baselineParticipation = (
    await db
      .select()
      .from(participants)
      .where(
        and(
          eq(participants.projectId, project),
          eq(participants.email, "seed-entry-details@example.org"),
        ),
      )
  )[0]!;
  baselineAssignment = (
    await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.partnershipId, partnership),
          eq(assignments.userId, organizer),
        ),
      )
  )[0]!;
  expect(baselineParticipation).toBeDefined();
  expect(baselineAssignment).toBeDefined();
});

beforeEach(async () => {
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  // Begin the authorization matrix with the canonical assignment revoked;
  // afterEach restores it even if a refusal/assertion fails.
  await db.delete(assignments).where(eq(assignments.partnershipId, partnership));

  actor = owner;
  activeOrganizationId = partner;
  vi.clearAllMocks();
  delivery.sendParticipantInvitation.mockResolvedValue(undefined);
  authMocks.getSession.mockImplementation(async () => ({
    user: {
      id: actor,
      name: actor,
      email: await actorEmailFor(actor),
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

async function restoreEntryBaseline() {
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(assignments).where(eq(assignments.partnershipId, partnership));
  await db.insert(assignments).values(baselineAssignment);
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.insert(participants).values(baselineParticipation);
}
afterEach(restoreEntryBaseline);

afterAll(async () => {
  await restoreEntryBaseline();
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Hosting Organization was deleted",
  ).not.toBeUndefined();
  expect(
    await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.organizationId, host),
        eq(projectsTable.name, SEED_ENTRY_PROJECT_NAME),
      ),
    }),
    "canonical entry Project was deleted",
  ).not.toBeUndefined();
  for (const email of [
    SEED_OWNER_EMAIL,
    SEED_COORDINATOR_EMAIL,
    SEED_ADMIN_EMAIL,
    SEED_PARTICIPANT_EMAIL,
  ]) {
    expect(
      await db.query.user.findFirst({ where: eq(user.email, email) }),
      `canonical seed User was deleted: ${email}`,
    ).not.toBeUndefined();
  }
});

describe("Project-scope participant entry authorization", () => {
  it.each([
    { key: "owner", permitted: true },
    { key: "admin", permitted: true },
    { key: "hybridAdmin", permitted: true },
    { key: "participant", permitted: false },
    { key: "coordinator", permitted: false },
  ])(
    "enforces the shared policy for a Partner Organization $key",
    async ({ key, permitted }) => {
      actor =
        key === "owner"
          ? owner
          : key === "admin"
            ? adminUserId
            : key === "hybridAdmin"
              ? hybridAdminUserId
              : key === "participant"
                ? participantUserId
                : organizer;
      activeOrganizationId = partner;
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
    },
  );

  it("permits an assigned Partner Group Organizer and refuses the same role without an assignment", async () => {
    actor = organizer;
    // Restore the canonical assignment after the unassigned branch.
    await db.insert(assignments).values(baselineAssignment);
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
    // Restore the canonical assignment after the unassigned branch.
    await db.insert(assignments).values(baselineAssignment);
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
    // Restore the canonical assignment after the unassigned branch.
    await db.insert(assignments).values(baselineAssignment);
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
    return baselineParticipation.id;
  }

  it.each([{ key: "owner" as const }, { key: "admin" as const }])(
    "serves a Partner Organization $key the details and lets them correct country",
    async ({ key }) => {
      const id = await seedParticipation();
      actor = key === "owner" ? owner : adminUserId;
      activeOrganizationId = partner;
      expect(
        await client.participations.get({
          partnershipId: partnership,
          id,
        }),
      ).toMatchObject({
        projectId: project,
        projectName: "Sustainability Conference",
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
    // Restore the canonical assignment after the unassigned branch.
    await db.insert(assignments).values(baselineAssignment);
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
