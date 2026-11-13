// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  claimsTable,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantProfilesTable as profiles,
  participantEntryTokensTable as entryTokens,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { ORPCError, createRouterClient } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
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

// Observe real transaction backends without replacing queries or row locks.
const transactionHooks = vi.hoisted(() => ({ onBegin: vi.fn() }));
vi.mock("@greendex/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@greendex/database")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, property) {
        if (property === "transaction") {
          return (
            callback: Parameters<typeof actual.db.transaction>[0],
            config: Parameters<typeof actual.db.transaction>[1],
          ) =>
            actual.db.transaction(async (tx) => {
              await transactionHooks.onBegin(tx);
              return callback(tx);
            }, config);
        }
        return Reflect.get(target, property);
      },
    }),
  };
});

const delivery = vi.hoisted(() => ({
  sendParticipantInvitation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email", () => ({
  sendParticipantInvitation: delivery.sendParticipantInvitation,
  emailSender: {},
}));

const joinHooks = vi.hoisted(() => ({ beforeRecheck: vi.fn() }));
vi.mock(
  "@/features/participant-onboarding/procedures/entry-tokens",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/participant-onboarding/procedures/entry-tokens")
      >();
    return {
      ...actual,
      recheckEntryToken: async (
        ...args: Parameters<typeof actual.recheckEntryToken>
      ) => {
        await joinHooks.beforeRecheck(args[2]);
        return actual.recheckEntryToken(...args);
      },
    };
  },
);

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  addMember: vi.fn(),
  hasPermission: vi.fn(),
  grantParticipantMembership: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  const { createJoinTransactionAuthMock } =
    await import("./join-transaction-auth-mock");
  return createJoinTransactionAuthMock(authMocks, actual);
});

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";

import { requireCostTrackerRole } from "@/features/organizations/roles";
import {
  createParticipantOnboardingProcedures,
  deliverParticipantInvitation,
} from "@/features/participant-onboarding/procedures/participant-onboarding";
import { createParticipationProcedures } from "@/features/participations/procedures/core";

/**
 * Seed identities for the onboarding Project (Climate Action
 * Workshop) with Partnerships to the second and third Partner Organizations. The Owner
 * issues; the seeded Invitee joins. Issuance and redemption go through the
 * procedures under test; per-test tokens, Participations, claims, profiles,
 * acceptances, and Memberships are removed afterwards without deleting
 * seed actors. See `SEED_SCENARIOS` in `apps/calculator/scripts/seed.ts`.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_SLUG = "seed-second-partner-org";
const SEED_SECOND_PARTNER_SLUG = "seed-third-partner-org";
const SEED_ONBOARDING_PROJECT_NAME = "Climate Action Workshop";
const SEED_OWNER_EMAIL = "owner@sieh.org";
const recipientEmail = "seed-onboarding-invitee@example.org";
const secondInviteeEmail = "seed-second-onboarding-invitee@example.org";
const suffix = randomUUID();
let host = "";
let partner = "";
let otherPartner = "";
let project = "";
let partnership = "";
let otherPartnership = "";
let owner = "";
let recipient = "";
let secondInvitee = "";
let coordinator = "";
let partnerParticipant = "";
const roleInvitees = new Map<string, string>();
const baselineMemberships: (typeof member.$inferSelect)[] = [];
let actor = "";
let activeOrganizationId: string | null = null;
let version = { id: "fixture-agreement-v1", contentHash: "fixture-hash-v1" };
const client = createRouterClient(
  {
    participantOnboarding: createParticipantOnboardingProcedures(() => version),
    participations: createParticipationProcedures(() => version),
  },
  {
    context: async () => ({ headers: new Headers() }),
  },
);

type JoinTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function backendPid(tx: JoinTransaction): Promise<number> {
  const result = await tx.execute<{ pid: number }>(
    sql`select pg_backend_pid() as pid`,
  );
  return result.rows[0]!.pid;
}

/** Wait for observed PostgreSQL blocking, not elapsed time or scheduling guesses. */
async function waitForBlockedQuery(
  pid: number,
  blocker: number,
): Promise<string> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const result = await db.execute<{ query: string; blocked: boolean }>(sql`
      select query, ${blocker} = any(pg_blocking_pids(pid)) as blocked
      from pg_stat_activity where pid = ${pid}
    `);
    if (result.rows[0]?.blocked) return result.rows[0].query;
  }
  throw new Error(`Backend ${pid} did not block on backend ${blocker}`);
}

async function memberships() {
  return db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, recipient), eq(member.organizationId, host)));
}

/**
 * Stands in for Better Auth's supported server check: the active Membership's
 * stored role resolved against the single-sourced role definitions.
 */
async function authorizedActiveRole(permissions: Record<string, string[]>) {
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
  const role = membership?.role ?? "";
  return parseOrganizationRoles(role).some(
    (name) =>
      name in costTrackerOrganizationRoles &&
      costTrackerOrganizationRoles[
        name as keyof typeof costTrackerOrganizationRoles
      ].authorize(permissions as never).success,
  );
}

beforeAll(async () => {
  const seedHost = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_ORG_SLUG),
  });
  if (!seedHost) throw new Error("Seed Hosting Organization is missing");
  const seedPartner = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_PARTNER_SLUG),
  });
  if (!seedPartner) throw new Error("Seed Partner Organization is missing");
  const seedSecond = await db.query.organization.findFirst({
    where: eq(organization.slug, SEED_SECOND_PARTNER_SLUG),
  });
  if (!seedSecond) throw new Error("Seed second Partner Organization is missing");
  const seedProject = await db.query.projectsTable.findFirst({
    where: and(
      eq(projectsTable.organizationId, seedHost.id),
      eq(projectsTable.name, SEED_ONBOARDING_PROJECT_NAME),
    ),
  });
  if (!seedProject) throw new Error("Seed onboarding Project is missing");
  const mainPartnership =
    await db.query.projectPartnerOrganizationsTable.findFirst({
      where: and(
        eq(partnerships.projectId, seedProject.id),
        eq(partnerships.organizationId, seedPartner.id),
      ),
    });
  if (!mainPartnership) throw new Error("Seed onboarding Partnership is missing");
  const secondPartnership =
    await db.query.projectPartnerOrganizationsTable.findFirst({
      where: and(
        eq(partnerships.projectId, seedProject.id),
        eq(partnerships.organizationId, seedSecond.id),
      ),
    });
  if (!secondPartnership)
    throw new Error("Seed onboarding second Partnership is missing");
  async function userIdFor(email: string): Promise<string> {
    const stored = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (!stored) throw new Error(`Seed User is missing: ${email}`);
    return stored.id;
  }
  host = seedHost.id;
  partner = seedPartner.id;
  otherPartner = seedSecond.id;
  project = seedProject.id;
  partnership = mainPartnership.id;
  otherPartnership = secondPartnership.id;
  owner = await userIdFor(SEED_OWNER_EMAIL);
  recipient = await userIdFor(recipientEmail);
  secondInvitee = await userIdFor(secondInviteeEmail);
  coordinator = await userIdFor("seed-coordinator@example.org");
  partnerParticipant = await userIdFor("seed-participant@example.org");
  for (const [name, role] of [
    ["owner", "owner"],
    ["admin", "admin"],
    ["participant", "participant"],
    ["coordinator", ORGANIZATION_ROLES.ProjectCoordinator],
    [
      "combined",
      `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
    ],
  ]) {
    const id = await userIdFor(`seed-onboarding-${name}@example.org`);
    roleInvitees.set(role!, id);
    baselineMemberships.push(
      ...(await db
        .select()
        .from(member)
        .where(and(eq(member.userId, id), eq(member.organizationId, host)))),
    );
  }
  expect(baselineMemberships).toHaveLength(5);
  expect(
    await db.query.member.findFirst({
      where: and(eq(member.userId, owner), eq(member.organizationId, host)),
    }),
  ).toMatchObject({ role: ORGANIZATION_ROLES.OrganizationOwner });
  actor = owner;
  activeOrganizationId = partner;
});

beforeEach(async () => {
  recipient = (await db.query.user.findFirst({
    where: eq(user.email, recipientEmail),
  }))!.id;
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(acceptances).where(eq(acceptances.userId, secondInvitee));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, secondInvitee));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(claimsTable).where(eq(claimsTable.partnershipId, partnership));
  await db.delete(member).where(eq(member.userId, recipient));
  await db.delete(member).where(eq(member.userId, secondInvitee));
  actor = owner;
  activeOrganizationId = partner;
  version = { id: "fixture-agreement-v1", contentHash: "fixture-hash-v1" };
  vi.clearAllMocks();
  joinHooks.beforeRecheck.mockReset();
  transactionHooks.onBegin.mockReset();
  delivery.sendParticipantInvitation.mockResolvedValue(undefined);
  authMocks.getSession.mockImplementation(async () => {
    const stored = await db.query.user.findFirst({
      where: eq(user.id, actor),
    });
    if (!stored) throw new Error(`Seed user is missing: ${actor}`);
    return {
      user: {
        id: actor,
        name: stored.name,
        email: stored.email,
        emailVerified: true,
      },
      session: { id: randomUUID(), activeOrganizationId },
    };
  });
  // Only sessions and error injection are mocked. Membership writes use the
  // real Better Auth APIs bound to the join transaction, including role hooks.
  authMocks.grantParticipantMembership.mockImplementation((input, api) =>
    api.grantParticipantMembership(input),
  );
  authMocks.addMember.mockImplementation((input, api) => api.addMember(input));
  authMocks.hasPermission.mockImplementation(
    async ({ body }: { body: { permissions: Record<string, string[]> } }) => ({
      success: await authorizedActiveRole(body.permissions),
    }),
  );
});

afterEach(async () => {
  for (const baseline of baselineMemberships) {
    await db.delete(acceptances).where(eq(acceptances.userId, baseline.userId));
    await db.delete(profiles).where(eq(profiles.userId, baseline.userId));
    await db
      .delete(participants)
      .where(
        and(
          eq(participants.projectId, project),
          eq(participants.userId, baseline.userId),
        ),
      );
    await db
      .update(member)
      .set({ role: baseline.role })
      .where(eq(member.id, baseline.id));
  }
  recipient = (await db.query.user.findFirst({
    where: eq(user.email, recipientEmail),
  }))!.id;
});

afterAll(async () => {
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(acceptances).where(eq(acceptances.userId, secondInvitee));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, secondInvitee));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(claimsTable).where(eq(claimsTable.partnershipId, partnership));
  await db.delete(member).where(eq(member.userId, recipient));
  await db.delete(member).where(eq(member.userId, secondInvitee));
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "seed Hosting Organization was deleted",
  ).not.toBeUndefined();
  expect(
    await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.organizationId, host),
        eq(projectsTable.name, SEED_ONBOARDING_PROJECT_NAME),
      ),
    }),
    "seed onboarding Project was deleted",
  ).not.toBeUndefined();
  for (const email of [SEED_OWNER_EMAIL, recipientEmail, secondInviteeEmail]) {
    expect(
      await db.query.user.findFirst({ where: eq(user.email, email) }),
      `seed User was deleted: ${email}`,
    ).not.toBeUndefined();
  }
  expect(
    await db.query.member.findFirst({
      where: and(eq(member.userId, owner), eq(member.organizationId, host)),
    }),
  ).toMatchObject({ role: ORGANIZATION_ROLES.OrganizationOwner });
  for (const baseline of baselineMemberships) {
    expect(
      await db.query.member.findFirst({ where: eq(member.id, baseline.id) }),
    ).toMatchObject({ role: baseline.role });
  }
  for (const inviteeId of [recipient, secondInvitee]) {
    expect(
      await db.query.member.findMany({
        where: eq(member.userId, inviteeId),
      }),
      "seed Invitee kept a case Membership",
    ).toEqual([]);
  }
});

describe("Participant onboarding procedures", () => {
  it("distinguishes missing invitation, wrong account and expired state without writes", async () => {
    const input = (invitationId: string, secret: string) => ({
      source: { kind: "invitation" as const, invitationId, secret },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    });
    actor = recipient;
    await expect(
      client.participantOnboarding.join(input("missing", "forged")),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
    });
    actor = owner;
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    // A forwarded link grants nothing to another account, even with the secret.
    await expect(
      client.participantOnboarding.join(
        input(issued.invitationId, issued.secret!),
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_INVITATION_WRONG_ACCOUNT" },
    });
    // A forged secret resolves to nothing, without leaking the bound email.
    actor = recipient;
    await expect(
      client.participantOnboarding.join(input(issued.invitationId, "forged")),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
    });
    await db
      .update(entryTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(entryTokens.id, issued.invitationId));
    await expect(
      client.participantOnboarding.join(
        input(issued.invitationId, issued.secret!),
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      data: { reason: "PARTICIPANT_INVITATION_EXPIRED" },
    });
    expect(authMocks.addMember).not.toHaveBeenCalled();
    expect(await memberships()).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
  });

  it("names absent invitation/link resources and absent replacement", async () => {
    await expect(
      client.participantOnboarding.setInvitationOpen({
        invitationId: "missing",
        open: true,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
    });
    await expect(
      client.participantOnboarding.setRegistrationLinkOpen({
        id: "missing",
        open: true,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "REGISTRATION_LINK_NOT_FOUND" },
    });
    await expect(
      client.participantOnboarding.reissueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
    });
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
  });

  it.each([
    // Privileged grant failures describe server configuration, never the
    // already authenticated Invitee, so session/permission refusals there
    // become internal failures while rate and availability pass through.
    [401, 500, "INTERNAL_FAILURE"],
    [403, 500, "INTERNAL_FAILURE"],
    [429, 429, "RATE_LIMITED"],
    [503, 503, "SERVICE_UNAVAILABLE"],
    [500, 500, "INTERNAL_FAILURE"],
  ] as const)(
    "preserves membership-grant status %s without app writes",
    async (status, expectedStatus, expectedReason) => {
      const issued = await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      });
      actor = recipient;
      authMocks.addMember.mockResolvedValueOnce(new Response(null, { status }));
      await expect(
        client.participantOnboarding.join({
          source: {
            kind: "invitation",
            invitationId: issued.invitationId,
            secret: issued.secret!,
          },
          profile: { fullName: "Recipient", country: "LV" as const },
          agreement: { accepted: true },
        }),
      ).rejects.toMatchObject({
        code:
          expectedStatus === 429
            ? "TOO_MANY_REQUESTS"
            : expectedStatus === 503
              ? "SERVICE_UNAVAILABLE"
              : "INTERNAL_SERVER_ERROR",
        data: { reason: expectedReason },
      });
      expect(await memberships()).toHaveLength(0);
      expect(
        await db
          .select()
          .from(participants)
          .where(eq(participants.projectId, project)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(acceptances)
          .where(eq(acceptances.userId, recipient)),
      ).toHaveLength(0);
    },
  );

  it("refuses unverified sessions before any grant call or app write", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    // Membership completion never starts for an unverified account: the
    // procedure refuses before any grant call or app write.
    authMocks.getSession.mockImplementationOnce(async () => ({
      user: {
        id: recipient,
        name: "Recipient",
        email: recipientEmail,
        emailVerified: false,
      },
      session: { id: randomUUID(), activeOrganizationId },
    }));
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: issued.invitationId,
          secret: issued.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "EMAIL_VERIFICATION_REQUIRED" },
    });
    expect(authMocks.addMember).not.toHaveBeenCalled();
    expect(await memberships()).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
  });

  it.each([
    ["link", false],
    ["invitation", false],
    ["link", true],
    ["invitation", true],
  ] as const)(
    "refuses a mid-join %s revoke and preserves existing state=%s",
    async (kind, existing) => {
      if (existing)
        recipient = roleInvitees.get(ORGANIZATION_ROLES.ProjectCoordinator)!;
      const stored = (await db.query.user.findFirst({
        where: eq(user.id, recipient),
      }))!;
      const issued =
        kind === "link"
          ? await client.participantOnboarding.createRegistrationLink({
              partnershipId: partnership,
            })
          : await client.participantOnboarding.issueInvitation({
              partnershipId: partnership,
              email: stored.email,
            });
      const id = "id" in issued ? issued.id : issued.invitationId;
      const source =
        kind === "link"
          ? { kind, id, secret: issued.secret! }
          : { kind, invitationId: id, secret: issued.secret! };
      if (existing) {
        await db.insert(participants).values({
          projectId: project,
          representedOrganizationId: partner,
          userId: recipient,
          displayName: "Before",
          email: stored.email,
          country: "FR",
        });
      }
      const beforeMemberships = await memberships();
      const beforeParticipants = await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project));
      actor = recipient;
      joinHooks.beforeRecheck.mockImplementationOnce(async () => {
        await db
          .update(entryTokens)
          .set({ status: "revoked" })
          .where(eq(entryTokens.id, id));
      });
      await expect(
        client.participantOnboarding.join({
          source,
          profile: { fullName: "Recipient", country: "LV" },
          agreement: { accepted: true },
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        data: {
          reason:
            kind === "link"
              ? "REGISTRATION_LINK_CLOSED"
              : "PARTICIPANT_INVITATION_CLOSED",
        },
      });
      expect(await memberships()).toEqual(beforeMemberships);
      expect(authMocks.addMember).not.toHaveBeenCalled();
      expect(authMocks.grantParticipantMembership).not.toHaveBeenCalled();
      expect(
        await db
          .select()
          .from(participants)
          .where(eq(participants.projectId, project)),
      ).toEqual(beforeParticipants);
      expect(
        await db.select().from(profiles).where(eq(profiles.userId, recipient)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(acceptances)
          .where(eq(acceptances.userId, recipient)),
      ).toEqual([]);
    },
  );

  it.each(["link", "invitation"] as const)(
    "rolls back a real Better Auth coordinator grant on %s failure and preserves existing state",
    async (kind) => {
      const coordinatorUser = roleInvitees.get(
        ORGANIZATION_ROLES.ProjectCoordinator,
      )!;
      const stored = (await db.query.user.findFirst({
        where: eq(user.id, coordinatorUser),
      }))!;
      const issued =
        kind === "link"
          ? await client.participantOnboarding.createRegistrationLink({
              partnershipId: partnership,
            })
          : await client.participantOnboarding.issueInvitation({
              partnershipId: partnership,
              email: stored.email,
            });
      const id = "id" in issued ? issued.id : issued.invitationId;
      const source =
        kind === "link"
          ? { kind, id, secret: issued.secret! }
          : { kind, invitationId: id, secret: issued.secret! };
      recipient = coordinatorUser;
      actor = recipient;
      const [legacy] = await db
        .insert(participants)
        .values({
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Legacy",
          email: stored.email,
        })
        .returning();
      await db.insert(profiles).values({ userId: recipient, fullName: "Before" });
      await db.insert(acceptances).values({
        userId: recipient,
        version: "before",
        contentHash: "before",
        answers: "before",
      });
      const beforeProfiles = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, recipient));
      const beforeAcceptances = await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, recipient));
      // Observe the real API write inside the transaction before the later identity conflict.
      authMocks.grantParticipantMembership.mockImplementationOnce(
        async (input, api) => {
          const response = await api.grantParticipantMembership(input);
          expect(response.ok).toBe(true);
          expect(await response.clone().json()).toMatchObject({
            member: {
              role: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
            },
          });
          return response;
        },
      );
      await expect(
        client.participantOnboarding.join({
          source,
          profile: { fullName: "After", country: "LV" },
          agreement: { accepted: true },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(authMocks.grantParticipantMembership).toHaveBeenCalledTimes(1);
      expect(await memberships()).toEqual([
        { role: ORGANIZATION_ROLES.ProjectCoordinator },
      ]);
      expect(
        await db
          .select()
          .from(participants)
          .where(eq(participants.projectId, project)),
      ).toEqual([legacy]);
      expect(
        await db.select().from(profiles).where(eq(profiles.userId, recipient)),
      ).toEqual(beforeProfiles);
      expect(
        await db
          .select()
          .from(acceptances)
          .where(eq(acceptances.userId, recipient)),
      ).toEqual(beforeAcceptances);
    },
  );

  it("does not deadlock a token close whose closedByUserId references the joining User", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    let releaseClose!: () => void;
    const closeGate = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    let tokenLocked!: (pid: number) => void;
    const tokenReady = new Promise<number>((resolve) => {
      tokenLocked = resolve;
    });
    const close = db.transaction(async (tx) => {
      await tx
        .select({ id: entryTokens.id })
        .from(entryTokens)
        .where(eq(entryTokens.id, link.id))
        .for("update");
      tokenLocked(await backendPid(tx));
      await closeGate;
      // Match registration-link close's token update and its User FK check.
      await tx
        .update(entryTokens)
        .set({
          status: "revoked",
          closedAt: new Date(),
          closedByUserId: recipient,
        })
        .where(eq(entryTokens.id, link.id));
    });
    const closeOutcome = close.then(
      () => ({ ok: true }),
      (error) => ({ error }),
    );
    const closerPid = await tokenReady;
    let joinArrived!: (pid: number) => void;
    const joinReady = new Promise<number>((resolve) => {
      joinArrived = resolve;
    });
    transactionHooks.onBegin.mockImplementationOnce(
      async (tx: JoinTransaction) => {
        joinArrived(await backendPid(tx));
      },
    );
    actor = recipient;
    const join = client.participantOnboarding.join({
      source: { kind: "link", id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "LV" },
      agreement: { accepted: true },
    });
    const joinOutcome = join.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      const joinPid = await joinReady;
      // User lock is held; join is now blocked on the closer's token lock.
      const blockedQuery = await waitForBlockedQuery(joinPid, closerPid);
      expect(blockedQuery).toContain('"participant_entry_token"');
    } finally {
      releaseClose();
      await Promise.all([closeOutcome, joinOutcome]);
    }
    const [closed, joined] = await Promise.all([closeOutcome, joinOutcome]);
    expect(closed).toEqual({ ok: true });
    expect(joined).toMatchObject({
      error: { code: "CONFLICT", data: { reason: "REGISTRATION_LINK_CLOSED" } },
    });
    expect(await memberships()).toEqual([]);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toEqual([]);
    expect(
      (await db.select().from(entryTokens).where(eq(entryTokens.id, link.id)))[0],
    ).toMatchObject({ status: "revoked", closedByUserId: recipient });
  });

  it.each([false, true])(
    "serializes different-token joins with an overlapping failure=%s",
    async (fail) => {
      const link = await client.participantOnboarding.createRegistrationLink({
        partnershipId: partnership,
      });
      const invitation = await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      });
      actor = recipient;
      let firstPid = 0;
      transactionHooks.onBegin.mockImplementationOnce(
        async (tx: JoinTransaction) => {
          firstPid = await backendPid(tx);
        },
      );
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      authMocks.addMember.mockImplementationOnce(async (input, api) => {
        const response = await api.addMember(input);
        expect(response.ok).toBe(true);
        started();
        await gate;
        return fail ? new Response(null, { status: 503 }) : response;
      });
      const profile = { fullName: "Recipient", country: "LV" as const };
      const agreement = { accepted: true as const };
      const first = client.participantOnboarding.join({
        source: { kind: "link", id: link.id, secret: link.secret },
        profile,
        agreement,
      });
      // Install rejection handling before releasing the injected failure.
      const firstOutcome = first.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await entered;
      let arrived!: (pid: number) => void;
      const secondArrived = new Promise<number>((resolve) => {
        arrived = resolve;
      });
      transactionHooks.onBegin.mockImplementationOnce(
        async (tx: JoinTransaction) => {
          arrived(await backendPid(tx));
        },
      );
      const second = client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: invitation.invitationId,
          secret: invitation.secret!,
        },
        profile,
        agreement,
      });
      const completed = Promise.allSettled([firstOutcome, second]);
      // Do not let the first transaction finish until PostgreSQL proves that
      // the second has attempted the User lock and is waiting on the first.
      try {
        const secondPid = await secondArrived;
        const blockedQuery = await waitForBlockedQuery(secondPid, firstPid);
        expect(blockedQuery).toMatch(/from "user".*for no key update/i);
      } finally {
        release();
        await completed;
      }
      const [outcome, successful] = await Promise.all([firstOutcome, second]);
      if (fail)
        expect(outcome).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
      else expect(outcome).toEqual({ value: successful });
      expect(await memberships()).toEqual([
        { role: ORGANIZATION_ROLES.Participant },
      ]);
      expect(
        await db
          .select()
          .from(participants)
          .where(eq(participants.projectId, project)),
      ).toHaveLength(1);
      expect(authMocks.addMember).toHaveBeenCalledTimes(fail ? 2 : 1);
    },
  );

  it("keeps a successful join when an overlapping different-Partner join fails", async () => {
    const first = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    activeOrganizationId = otherPartner;
    const second = await client.participantOnboarding.createRegistrationLink({
      partnershipId: otherPartnership,
    });
    activeOrganizationId = partner;
    actor = recipient;
    const outcomes = await Promise.allSettled(
      [first, second].map((link) =>
        client.participantOnboarding.join({
          source: { kind: "link", id: link.id, secret: link.secret },
          profile: { fullName: "Recipient", country: "LV" },
          agreement: { accepted: true },
        }),
      ),
    );
    const successful = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const failed = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(successful).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.reason).toMatchObject({
      code: "CONFLICT",
      data: { reason: "JOINED_OTHER_PARTNER" },
    });
    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.projectId, project));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(successful[0]!.value.participationId);
    expect(await memberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
    expect(authMocks.addMember).toHaveBeenCalledTimes(1);
  });

  it("separately gates missing profile and stale agreement before listing Participations", async () => {
    actor = recipient;
    await expect(
      client.participantOnboarding.listMyProjects(),
    ).rejects.toMatchObject({
      code: "UNPROCESSABLE_CONTENT",
      data: { reason: "PARTICIPANT_PROFILE_REQUIRED" },
      message: "Complete your Participant profile before accessing Projects.",
    });
    await client.participantOnboarding.saveProfile({ fullName: "Recipient" });
    await expect(
      client.participantOnboarding.listMyProjects(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
      message:
        "Accept the current Participant agreement before accessing Projects.",
    });
    await client.participantOnboarding.acceptAgreement({ accepted: true });
    expect(await client.participantOnboarding.listMyProjects()).toEqual([]);
  });

  it("joins through a reusable link, gates Projects on the current agreement, and preserves earlier acceptance", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    activeOrganizationId = undefined as unknown as string;
    const joined = await client.participantOnboarding.join({
      source: { kind: "link", id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true },
    });
    expect(joined.participationId).toBeTruthy();
    expect(await memberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
    expect(await client.participantOnboarding.listMyProjects()).toEqual([
      {
        participationId: joined.participationId,
        projectId: project,
        projectName: "Climate Action Workshop",
        representedOrganizationName: "Seed Second Partner Organization",
        hostingOrganizationName: "Seed Organization",
      },
    ]);
    version = { id: "fixture-agreement-v2", contentHash: "fixture-hash-v2" };
    await expect(
      client.participantOnboarding.listMyProjects(),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_AGREEMENT_REQUIRED" },
      message:
        "Accept the current Participant agreement before accessing Projects.",
    });
    await client.participantOnboarding.acceptAgreement({ accepted: true });
    expect(await client.participantOnboarding.listMyProjects()).toHaveLength(1);
    expect(
      await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, recipient)),
    ).toHaveLength(2);
  });

  it("blocks a second join through another Partner Organization and closes/reopens registration", async () => {
    actor = owner;
    activeOrganizationId = partner;
    const created = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    await client.participantOnboarding.setRegistrationLinkOpen({
      id: created.id,
      open: false,
    });
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: created.id, secret: created.secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    actor = owner;
    await client.participantOnboarding.setRegistrationLinkOpen({
      id: created.id,
      open: true,
    });
    actor = recipient;
    await client.participantOnboarding.join({
      source: { kind: "link", id: created.id, secret: created.secret },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true },
    });
    // A second partner's link is never authority to replace a previous Participation.
    // The seed Owner also owns the third Partner Organization.
    actor = owner;
    activeOrganizationId = otherPartner;
    const second = await client.participantOnboarding.createRegistrationLink({
      partnershipId: otherPartnership,
    });
    actor = recipient;
    activeOrganizationId = partner;
    try {
      await expect(
        client.participantOnboarding.join({
          source: { kind: "link", id: second.id, secret: second.secret },
          profile: { fullName: "Recipient", country: "LV" as const },
          agreement: { accepted: true },
        }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message:
          "You already joined this Project through another Partner Organization.",
      });
    } finally {
      activeOrganizationId = partner;
    }
  });

  it("creates additional independent links and closes only the selected link", async () => {
    const first = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    const second = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    expect(first.id).not.toBe(second.id);
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.partnershipId, partnership)),
    ).toHaveLength(2);
    await client.participantOnboarding.setRegistrationLinkOpen({
      id: first.id,
      open: false,
    });
    const scoped = await client.participations.listPartnership({
      partnershipId: partnership,
    });
    expect(scoped.registrationLinks).toEqual(
      expect.arrayContaining([
        { id: first.id, enabled: false },
        { id: second.id, enabled: true },
      ]),
    );
    expect(JSON.stringify(scoped)).not.toContain(first.secret);
    expect(JSON.stringify(scoped)).not.toContain("secretHash");
    await expect(
      client.participations.listPartnership({ partnershipId: otherPartnership }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const rows = await db
      .select()
      .from(entryTokens)
      .where(eq(entryTokens.partnershipId, partnership));
    expect(rows.find((row) => row.id === first.id)?.status).toBe("revoked");
    expect(rows.find((row) => row.id === second.id)?.status).toBe("pending");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: first.id, secret: first.secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: second.id, secret: second.secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("blocks reopening registration after the Partnership's Claim is submitted", async () => {
    // SEED_SCENARIOS.reviewFixes.submittedRegistration supplies a revoked
    // link on a submitted Claim; only the reopening behavior is under test.
    const link = { id: "ld3ukgstb6tzbgvte5qmr33l" };
    expect(
      (
        await db
          .select()
          .from(claimsTable)
          .where(eq(claimsTable.partnershipId, "yrrjw45ya3ehy4t3nobhe59b"))
      )[0]?.status,
    ).toBe("submitted");
    await expect(
      client.participantOnboarding.setRegistrationLinkOpen({
        id: link.id,
        open: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await db.select().from(entryTokens).where(eq(entryTokens.id, link.id)))[0]
        ?.status,
    ).toBe("revoked");
  });

  it("keeps existing owner/admin/participant roles, and grants participant to coordinators without removing roles", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const join = () =>
      client.participantOnboarding.join({
        source: { kind: "link" as const, id: link.id, secret: link.secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true as const },
      });
    for (const role of [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.Participant,
      ORGANIZATION_ROLES.ProjectCoordinator,
      `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
    ]) {
      await db.delete(participants).where(eq(participants.projectId, project));
      recipient = roleInvitees.get(role)!;
      expect(recipient).toBeTruthy();
      actor = recipient;
      await join();
      expect(await memberships()).toEqual([
        {
          role:
            role === ORGANIZATION_ROLES.ProjectCoordinator
              ? `${role},participant`
              : role,
        },
      ]);
    }
    expect(authMocks.addMember).not.toHaveBeenCalled();
    expect(authMocks.grantParticipantMembership).toHaveBeenCalledTimes(1);
    // ADR-0012: fallback roles are refused in memory, never seeded or upgraded.
    for (const invalidRole of [
      "invalid-role",
      `invalid-role,${ORGANIZATION_ROLES.ProjectCoordinator}`,
    ]) {
      let refusal: unknown;
      try {
        requireCostTrackerRole(
          invalidRole,
          (options) => new ORPCError("BAD_REQUEST", options),
        );
      } catch (error) {
        refusal = error;
      }
      expect(refusal).toMatchObject({
        code: "BAD_REQUEST",
        message: "Use a defined Organization role.",
      });
    }
  });

  it("completes competing joins with one Participation, one Membership, and safe retry", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    recipient = roleInvitees.get(ORGANIZATION_ROLES.ProjectCoordinator)!;
    actor = recipient;
    const input = {
      source: { kind: "link" as const, id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    };
    const outcomes = await Promise.allSettled([
      client.participantOnboarding.join(input),
      client.participantOnboarding.join(input),
    ]);
    const participationIds: string[] = [];
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled")
        participationIds.push(outcome.value.participationId);
      else
        participationIds.push(
          (await client.participantOnboarding.join(input)).participationId,
        );
    }
    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.projectId, project));
    expect(rows).toHaveLength(1);
    expect(new Set(participationIds)).toEqual(new Set([rows[0]!.id]));
    expect(await memberships()).toEqual([
      {
        role: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
      },
    ]);
    expect(authMocks.addMember).not.toHaveBeenCalled();
  });

  it("reports a changed Membership and succeeds on retry with a fresh read", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    recipient = roleInvitees.get(ORGANIZATION_ROLES.ProjectCoordinator)!;
    actor = recipient;
    const input = {
      source: { kind: "link" as const, id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    };
    authMocks.grantParticipantMembership.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "MEMBERSHIP_CHANGED" }), {
        status: 400,
      }),
    );
    await expect(client.participantOnboarding.join(input)).rejects.toMatchObject({
      code: "CONFLICT",
      data: { reason: "MEMBERSHIP_CHANGED" },
    });
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(0);
    const retried = await client.participantOnboarding.join(input);
    expect(retried.participationId).toBeTruthy();
    expect(await memberships()).toEqual([
      {
        role: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
      },
    ]);
  });

  it("revokes the invitation on close and requires re-issue to recover", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await client.participantOnboarding.setInvitationOpen({
      invitationId: issued.invitationId,
      open: false,
    });
    const [revoked] = await db
      .select({ status: entryTokens.status })
      .from(entryTokens)
      .where(eq(entryTokens.id, issued.invitationId));
    expect(revoked?.status).toBe("revoked");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: issued.invitationId,
          secret: issued.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(authMocks.addMember).not.toHaveBeenCalled();
    expect(await memberships()).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
    actor = owner;
    // Reopening never resurrects the canceled native row: re-issue instead.
    await expect(
      client.participantOnboarding.setInvitationOpen({
        invitationId: issued.invitationId,
        open: true,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const reissued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(reissued.invitationId).not.toBe(issued.invitationId);
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: reissued.invitationId,
          secret: reissued.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("explicitly rotates invitations twice, leaving one live invitation per Project email", async () => {
    const first = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(first.delivery).toBe("sent");
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledWith({
      email: recipientEmail,
      invitationId: first.invitationId,
      secret: first.secret,
    });
    expect(
      await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).toEqual({
      invitationId: first.invitationId,
      secret: null,
      delivery: "already-issued",
    });
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledTimes(1);
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(1);
    const second = await client.participantOnboarding.reissueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    const third = await client.participantOnboarding.reissueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(
      new Set([first.invitationId, second.invitationId, third.invitationId]).size,
    ).toBe(3);
    expect(second.delivery).toBe("sent");
    expect(third.delivery).toBe("sent");
    expect(delivery.sendParticipantInvitation.mock.calls).toEqual([
      [
        {
          email: recipientEmail,
          invitationId: first.invitationId,
          secret: first.secret,
        },
      ],
      [
        {
          email: recipientEmail,
          invitationId: second.invitationId,
          secret: second.secret,
        },
      ],
      [
        {
          email: recipientEmail,
          invitationId: third.invitationId,
          secret: third.secret,
        },
      ],
    ]);
    const rows = await db
      .select()
      .from(entryTokens)
      .where(eq(entryTokens.projectId, project));
    expect(
      rows.filter((row) => row.status === "pending").map((row) => row.id),
    ).toEqual([third.invitationId]);
    expect(rows.filter((row) => row.status === "revoked")).toHaveLength(2);
    expect(rows.find((row) => row.id === third.invitationId)).toMatchObject({
      partnershipId: partnership,
      projectId: project,
      email: recipientEmail,
      issuedByUserId: owner,
      status: "pending",
    });
    actor = recipient;
    // A superseded identity cannot be redeemed, even with its own secret.
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: first.invitationId,
          secret: first.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: third.invitationId,
          secret: third.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
    expect(await memberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
  });

  it("keeps a Partner Organization's invitation with its issuer, including against Hosting staff", async () => {
    const first = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await expect(
      client.participantOnboarding.reissueInvitation({
        partnershipId: otherPartnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (
        await db
          .select()
          .from(entryTokens)
          .where(eq(entryTokens.id, first.invitationId))
      )[0]?.status,
    ).toBe("pending");
    activeOrganizationId = otherPartner;
    try {
      await expect(
        client.participantOnboarding.reissueInvitation({
          partnershipId: otherPartnership,
          email: recipientEmail,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (
          await db
            .select()
            .from(entryTokens)
            .where(eq(entryTokens.id, first.invitationId))
        )[0]?.status,
      ).toBe("pending");
    } finally {
      activeOrganizationId = partner;
    }
    activeOrganizationId = host;
    try {
      // ADR-0015: the Hosting Organization issues no participant entry points,
      // so it can no longer take an invitation over from the Partner side.
      await expect(
        client.participantOnboarding.reissueInvitation({
          partnershipId: otherPartnership,
          email: recipientEmail,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "PARTNER_ENTRY_REQUIRED" },
      });
      const rows = await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project));
      expect(rows.filter((row) => row.status === "pending")).toMatchObject([
        { id: first.invitationId, partnershipId: partnership },
      ]);
    } finally {
      activeOrganizationId = partner;
    }
  });

  it("retires an expired invitation and issues fresh on the next request", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await db
      .update(entryTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(entryTokens.id, issued.invitationId));
    const fresh = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(fresh.invitationId).not.toBe(issued.invitationId);
    const [retired] = await db
      .select({ status: entryTokens.status })
      .from(entryTokens)
      .where(eq(entryTokens.id, issued.invitationId));
    expect(retired?.status).toBe("revoked");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: fresh.invitationId,
          secret: fresh.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("rejects forged and closed links before any membership or app writes", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const join = (secret: string) =>
      client.participantOnboarding.join({
        source: { kind: "link" as const, id: link.id, secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true as const },
      });
    await expect(join("forged")).rejects.toMatchObject({ code: "NOT_FOUND" });
    actor = owner;
    await client.participantOnboarding.setRegistrationLinkOpen({
      id: link.id,
      open: false,
    });
    actor = recipient;
    await expect(join(link.secret)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await memberships()).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
  });

  it("does not write profile, acceptance or Participation if the membership grant fails, and retry succeeds", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    authMocks.addMember.mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );
    const input = {
      source: {
        kind: "invitation" as const,
        invitationId: issued.invitationId,
        secret: issued.secret!,
      },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    };
    await expect(client.participantOnboarding.join(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, recipient)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(0);
    expect(await client.participantOnboarding.join(input)).toHaveProperty(
      "participationId",
    );
  });

  it("rolls back the membership when the join fails and permits a retry", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    const input = {
      source: {
        kind: "invitation" as const,
        invitationId: issued.invitationId,
        secret: issued.secret!,
      },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    };
    // A legacy email-only collision cannot be created through authenticated
    // onboarding. Inject it to exercise rollback after the supported grant.
    const [conflict] = await db
      .insert(participants)
      .values({
        projectId: project,
        representedOrganizationId: partner,
        displayName: "Legacy",
        email: recipientEmail,
      })
      .returning({ id: participants.id });
    await expect(client.participantOnboarding.join(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await memberships()).toEqual([]);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, recipient)),
    ).toHaveLength(0);
    await db.delete(participants).where(eq(participants.id, conflict!.id));
    expect(await client.participantOnboarding.join(input)).toHaveProperty(
      "participationId",
    );
    // The failed grant rolled back, so the retry grants Membership again.
    expect(authMocks.addMember).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(1);
  });

  it("blocks an invitation to an already participating email", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    await client.participantOnboarding.join({
      source: { kind: "link", id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "LV" },
      agreement: { accepted: true },
    });
    actor = owner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(
          and(
            eq(entryTokens.projectId, project),
            eq(entryTokens.email, recipientEmail),
          ),
        ),
    ).toHaveLength(0);
  });

  it("reports SMTP failure after committing and never resends on an idempotent retry", async () => {
    delivery.sendParticipantInvitation.mockRejectedValueOnce(
      new Error("SMTP unavailable"),
    );
    const first = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(first.delivery).toBe("failed");
    // The invitation is durably issued despite the delivery failure.
    expect(
      (
        await db
          .select()
          .from(entryTokens)
          .where(eq(entryTokens.id, first.invitationId))
      )[0]?.status,
    ).toBe("pending");
    expect(
      await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).toEqual({
      invitationId: first.invitationId,
      secret: null,
      delivery: "already-issued",
    });
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledTimes(1);
    // Retry through reissue rotates the identity without duplicate grants.
    const second = await client.participantOnboarding.reissueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(second.delivery).toBe("sent");
    expect(second.invitationId).not.toBe(first.invitationId);
    expect(delivery.sendParticipantInvitation).toHaveBeenNthCalledWith(2, {
      email: recipientEmail,
      invitationId: second.invitationId,
      secret: second.secret,
    });
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: {
          kind: "invitation",
          invitationId: second.invitationId,
          secret: second.secret!,
        },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(1);
  });

  it("skips delivery when a previously issued invitation is retired before send", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(issued.delivery).toBe("sent");
    delivery.sendParticipantInvitation.mockClear();
    await db
      .update(entryTokens)
      .set({ status: "revoked" })
      .where(eq(entryTokens.id, issued.invitationId));
    expect(
      await deliverParticipantInvitation(
        recipientEmail,
        issued.invitationId,
        issued.secret!,
      ),
    ).toEqual({
      invitationId: issued.invitationId,
      secret: issued.secret,
      delivery: "failed",
    });
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
  });

  it("relies on the database to reject non-normalized participation emails", async () => {
    // This DB-rejection path cannot be expressed by validated onboarding.
    // project_participant_email_normalized (since migration 0015) makes a
    // non-normalized legacy row impossible; the procedure's lower()
    // comparisons are defense-in-depth over this invariant.
    await expect(
      db.insert(participants).values({
        projectId: project,
        representedOrganizationId: partner,
        displayName: "Legacy",
        userId: recipient,
        email: recipientEmail.toUpperCase(),
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("refuses Hosting Organization owners, so no invitation, link or email is issued", async () => {
    actor = owner;
    activeOrganizationId = host;
    for (const attempt of [
      () =>
        client.participantOnboarding.issueInvitation({
          partnershipId: partnership,
          email: recipientEmail,
        }),
      () =>
        client.participantOnboarding.createRegistrationLink({
          partnershipId: partnership,
        }),
    ])
      await expect(attempt()).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "PARTNER_ENTRY_REQUIRED" },
      });
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.partnershipId, partnership)),
    ).toHaveLength(0);
  });

  it("refuses a Hosting Project coordinator even when assigned to the Project", async () => {
    actor = coordinator;
    activeOrganizationId = host;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_ENTRY_REQUIRED" },
    });
    expect(delivery.sendParticipantInvitation).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(0);
  });

  it("denies a responsible User without the coordinator role", async () => {
    actor = partnerParticipant;
    activeOrganizationId = partner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_COORDINATION_REQUIRED" },
    });
  });

  it("denies unassigned issuers and cross-Partnership owners with no invitation side effects", async () => {
    activeOrganizationId = otherPartner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    actor = partnerParticipant;
    activeOrganizationId = partner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
    ).toHaveLength(0);
  });

  it("allows an assigned Partner coordinator to issue invitations without changing roles", async () => {
    actor = coordinator;
    activeOrganizationId = partner;
    const membership = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, partner),
        eq(member.userId, coordinator),
      ),
    });
    expect(membership).toBeDefined();
    try {
      const issued = await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: `invite-${suffix}@example.org`,
      });
      expect(
        (
          await db
            .select({ partnershipId: entryTokens.partnershipId })
            .from(entryTokens)
            .where(eq(entryTokens.id, issued.invitationId))
        )[0]?.partnershipId,
      ).toBe(partnership);
      expect(
        (
          await db
            .select({ role: member.role })
            .from(member)
            .where(eq(member.id, membership!.id))
        )[0]?.role,
      ).toBe(ORGANIZATION_ROLES.ProjectCoordinator);
      await expect(
        client.participantOnboarding.issueInvitation({
          partnershipId: otherPartnership,
          email: `another-${suffix}@example.org`,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
    }
  });

  it("issues an email-bound invitation under normalization, then repeats redemption safely", async () => {
    actor = owner;
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: `  ${recipientEmail.toUpperCase()}  `,
    });
    // Duplicate issuance reports the live identity without resending and
    // without recovering the secret.
    expect(
      await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).toEqual({
      invitationId: issued.invitationId,
      secret: null,
      delivery: "already-issued",
    });
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledTimes(1);
    const [stored] = await db
      .select()
      .from(entryTokens)
      .where(eq(entryTokens.id, issued.invitationId));
    expect(stored).toMatchObject({
      partnershipId: partnership,
      projectId: project,
      email: recipientEmail,
      issuedByUserId: owner,
      status: "pending",
    });
    expect(stored?.secretHash).not.toContain(issued.secret!);
    actor = recipient;
    const input = {
      source: {
        kind: "invitation" as const,
        invitationId: issued.invitationId,
        secret: issued.secret!,
      },
      profile: { fullName: "Recipient", country: "LV" as const },
      agreement: { accepted: true as const },
    };
    const first = await client.participantOnboarding.join(input);
    // Repeat successful redemption resolves to the same identity.
    expect(await client.participantOnboarding.join(input)).toEqual(first);
    expect(
      (
        await db
          .select()
          .from(entryTokens)
          .where(eq(entryTokens.id, issued.invitationId))
      )[0]?.status,
    ).toBe("accepted");
    expect(await memberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
  });

  it("persists the EU country on the Project Participation when joining through a reusable link", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const joined = await client.participantOnboarding.join({
      source: { kind: "link", id: link.id, secret: link.secret },
      profile: { fullName: "Recipient", country: "DE" },
      agreement: { accepted: true },
    });
    const [row] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, joined.participationId));
    expect(row?.country).toBe("DE");
    expect(row?.userId).toBe(recipient);
    // The country lives on the Participation, never on the User profile.
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(1);
  });

  it("rejects link joins without a valid EU country before any writes", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const join = (profile: unknown) =>
      client.participantOnboarding.join({
        source: { kind: "link" as const, id: link.id, secret: link.secret },
        profile,
        agreement: { accepted: true as const },
      } as never);
    await expect(
      join({ fullName: "Recipient", country: "XX" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(join({ fullName: "Recipient" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await memberships()).toHaveLength(0);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, recipient)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, recipient)),
    ).toHaveLength(0);
  });

  it("lets different Users redeem the same link without consuming it, and repeats idempotently", async () => {
    const second = secondInvitee;
    try {
      const link = await client.participantOnboarding.createRegistrationLink({
        partnershipId: partnership,
      });
      const linkInput = {
        source: { kind: "link" as const, id: link.id, secret: link.secret },
        agreement: { accepted: true as const },
      };
      actor = recipient;
      const first = await client.participantOnboarding.join({
        ...linkInput,
        profile: { fullName: "Recipient", country: "LV" as const },
      });
      // One redemption never consumes the link globally.
      expect(
        (
          await db.select().from(entryTokens).where(eq(entryTokens.id, link.id))
        )[0]?.status,
      ).toBe("pending");
      // Same-User repeat redemption is idempotent.
      expect(
        await client.participantOnboarding.join({
          ...linkInput,
          profile: { fullName: "Recipient", country: "LV" as const },
        }),
      ).toEqual(first);
      // A second eligible User redeems the same link independently.
      authMocks.getSession.mockImplementation(async () => {
        const stored = await db.query.user.findFirst({
          where: eq(user.id, second),
        });
        if (!stored) throw new Error(`Seed user is missing: ${second}`);
        return {
          user: {
            id: second,
            name: stored.name,
            email: stored.email,
            emailVerified: true,
          },
          session: { id: randomUUID(), activeOrganizationId },
        };
      });
      actor = second;
      const other = await client.participantOnboarding.join({
        ...linkInput,
        profile: { fullName: "Second", country: "FR" },
      });
      expect(other.participationId).not.toBe(first.participationId);
      const rows = await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project));
      expect(rows).toHaveLength(2);
      expect(rows.find((row) => row.userId === second)?.country).toBe("FR");
      const [acceptance] = await db
        .select()
        .from(acceptances)
        .where(eq(acceptances.userId, second));
      expect(acceptance).toMatchObject({
        version: version.id,
        contentHash: version.contentHash,
      });
    } finally {
      await db.delete(acceptances).where(eq(acceptances.userId, second));
      await db.delete(profiles).where(eq(profiles.userId, second));
      await db.delete(participants).where(eq(participants.projectId, project));
      await db.delete(member).where(eq(member.userId, second));
    }
  });
});
