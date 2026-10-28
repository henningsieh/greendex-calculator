// @vitest-environment node
//
// Email-bound Participant Invitations on the shared app-owned entry flow
// (ADR-0013/0015, issue #213): lifecycle, email binding, and flavour parity
// through the oRPC procedure interface. Canonical seed actors (see
// `SEED_SCENARIOS` in `apps/calculator/scripts/seed.ts`) own the Hosting
// Organization, Partner Organization, Project, and Partnership; Invitees are
// seeded membership-free joiners. Issuance and redemption go through the
// procedures under test; per-test tokens, Participations, profiles, and
// acceptances are removed afterwards without deleting canonical actors.

import { randomUUID } from "node:crypto";

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantProfilesTable as profiles,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
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
  addMember: vi.fn(),
  hasPermission: vi.fn(),
  grantParticipantMembership: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: authMocks },
}));

import { listPendingInvitations } from "@/features/organizations/procedures/staff-invites";
import { createParticipantOnboardingProcedures } from "@/features/participant-onboarding/procedures/participant-onboarding";
import { createParticipationProcedures } from "@/features/participations/procedures/core";

/**
 * Canonical seed identities for the invitation Project (Green Energy
 * Symposium) and its Partnership to the second Partner Organization.
 * The Owner issues; the two seeded Invitees join. Case tokens,
 * Participations, profiles, acceptances, and Memberships are removed
 * afterwards; canonical actors are never deleted.
 */
const SEED_ORG_SLUG = "seed-org";
const SEED_PARTNER_SLUG = "seed-second-partner-org";
const SEED_INVITATION_PROJECT_NAME = "Green Energy Symposium";
const SEED_OWNER_EMAIL = "owner@sieh.org";
const recipientEmail = "seed-invitee@example.org";
const strangerEmail = "seed-second-invitee@example.org";
let coordinatorInvitee = "";
let host = "";
let partner = "";
let project = "";
let partnership = "";
let owner = "";
let recipient = "";
let stranger = "";
let actor = "";
let activeOrganizationId: string | null = null;

const agreement = { id: "fixture-agreement-v1", contentHash: "fixture-hash-v1" };
const client = createRouterClient(
  {
    participantOnboarding: createParticipantOnboardingProcedures(() => agreement),
    participations: createParticipationProcedures(() => agreement),
    organizations: { listPendingInvitations },
  },
  { context: async () => ({ headers: new Headers() }) },
);

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

async function sessionEmail(): Promise<string> {
  if (!actor) throw new Error("Actor is missing");
  const stored = await db.query.user.findFirst({
    where: eq(user.id, actor),
  });
  if (!stored) throw new Error(`Seed user is missing: ${actor}`);
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
  const seedProject = await db.query.projectsTable.findFirst({
    where: and(
      eq(projectsTable.organizationId, seedHost.id),
      eq(projectsTable.name, SEED_INVITATION_PROJECT_NAME),
    ),
  });
  if (!seedProject) throw new Error("Canonical invitation Project is missing");
  const seedPartnership =
    await db.query.projectPartnerOrganizationsTable.findFirst({
      where: and(
        eq(partnerships.projectId, seedProject.id),
        eq(partnerships.organizationId, seedPartner.id),
      ),
    });
  if (!seedPartnership)
    throw new Error("Canonical invitation Partnership is missing");
  async function userIdFor(email: string): Promise<string> {
    const stored = await db.query.user.findFirst({
      where: eq(user.email, email),
    });
    if (!stored) throw new Error(`Canonical seed User is missing: ${email}`);
    return stored.id;
  }
  host = seedHost.id;
  partner = seedPartner.id;
  project = seedProject.id;
  partnership = seedPartnership.id;
  owner = await userIdFor(SEED_OWNER_EMAIL);
  recipient = await userIdFor(recipientEmail);
  stranger = await userIdFor(strangerEmail);
  coordinatorInvitee = await userIdFor("seed-invitation-coordinator@example.org");
  actor = owner;
  activeOrganizationId = partner;
});

beforeEach(async () => {
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));

  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(acceptances).where(eq(acceptances.userId, stranger));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, stranger));
  await db.delete(member).where(eq(member.userId, recipient));
  await db.delete(member).where(eq(member.userId, stranger));
  actor = owner;
  activeOrganizationId = partner;
  vi.clearAllMocks();
  delivery.sendParticipantInvitation.mockResolvedValue(undefined);
  authMocks.getSession.mockImplementation(async () => ({
    user: {
      id: actor,
      name: actor,
      email: await sessionEmail(),
      emailVerified: true,
    },
    session: { id: randomUUID(), activeOrganizationId },
  }));
  authMocks.addMember.mockImplementation(
    async ({ body }: { body: { userId: string; organizationId: string } }) => {
      const [existing] = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.userId, body.userId),
            eq(member.organizationId, body.organizationId),
          ),
        )
        .limit(1);
      if (existing)
        return new Response(
          JSON.stringify({
            code: "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION",
          }),
          { status: 400 },
        );
      await db.insert(member).values({
        id: randomUUID(),
        organizationId: body.organizationId,
        userId: body.userId,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: new Date(),
      });
      return new Response(null, { status: 200 });
    },
  );
  authMocks.hasPermission.mockImplementation(
    async ({ body }: { body: { permissions: Record<string, string[]> } }) => ({
      success: await authorizedActiveRole(body.permissions),
    }),
  );
  authMocks.grantParticipantMembership.mockImplementation(
    async () => new Response(null, { status: 200 }),
  );
});

afterEach(async () => {
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(profiles).where(eq(profiles.userId, coordinatorInvitee));
  await db.delete(acceptances).where(eq(acceptances.userId, coordinatorInvitee));
  await db
    .update(member)
    .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
    .where(
      and(eq(member.userId, coordinatorInvitee), eq(member.organizationId, host)),
    );
});

afterAll(async () => {
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));

  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(acceptances).where(eq(acceptances.userId, stranger));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, stranger));
  await db.delete(member).where(eq(member.userId, recipient));
  await db.delete(member).where(eq(member.userId, stranger));
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
        eq(projectsTable.name, SEED_INVITATION_PROJECT_NAME),
      ),
    }),
    "canonical invitation Project was deleted",
  ).not.toBeUndefined();
  for (const email of [SEED_OWNER_EMAIL, recipientEmail, strangerEmail]) {
    expect(
      await db.query.user.findFirst({ where: eq(user.email, email) }),
      `canonical seed User was deleted: ${email}`,
    ).not.toBeUndefined();
  }
  for (const inviteeId of [recipient, stranger]) {
    expect(
      await db.query.member.findMany({
        where: eq(member.userId, inviteeId),
      }),
      "seed Invitee kept a case Membership",
    ).toEqual([]);
  }
});

const joinProfile = {
  profile: { fullName: "Recipient", country: "LV" as const },
  agreement: { accepted: true as const },
};

async function recipientMemberships() {
  return db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, recipient), eq(member.organizationId, host)));
}

describe("email-bound Participant Invitations", () => {
  it("issues a secret-bound invitation and lists it without leaking secret material", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(issued.secret).toEqual(expect.any(String));
    expect(issued.delivery).toBe("sent");
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledWith({
      email: recipientEmail,
      invitationId: issued.invitationId,
      secret: issued.secret,
    });
    const scoped = await client.participations.listPartnership({
      partnershipId: partnership,
    });
    expect(scoped.invitations).toEqual([
      {
        invitationId: issued.invitationId,
        email: recipientEmail,
        status: "pending",
      },
    ]);
    expect(JSON.stringify(scoped)).not.toContain(issued.secret);
    expect(JSON.stringify(scoped)).not.toContain("secretHash");
  });

  it("refuses a forwarded link for another verified account without writes", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = stranger;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: issued.invitationId,
          secret: issued.secret!,
        },
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTICIPANT_INVITATION_WRONG_ACCOUNT" },
    });
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.userId, stranger)),
    ).toHaveLength(0);
    // The invitation stays redeemable by its bound address.
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: issued.invitationId,
          secret: issued.secret!,
        },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("treats forged invitation identities as absent", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    for (const source of [
      {
        kind: "invitation" as const,
        invitationId: issued.invitationId,
        secret: "forged",
      },
      {
        kind: "invitation" as const,
        invitationId: randomUUID(),
        secret: issued.secret!,
      },
    ])
      await expect(
        client.participantOnboarding.join({ ...joinProfile, source }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        data: { reason: "PARTICIPANT_INVITATION_NOT_FOUND" },
      });
    expect(await recipientMemberships()).toHaveLength(0);
  });

  it("serializes simultaneous issuance and delivers only for the winner", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        client.participantOnboarding.issueInvitation({
          partnershipId: partnership,
          email: recipientEmail,
        }),
      ),
    );
    expect(new Set(results.map((result) => result.invitationId)).size).toBe(1);
    expect(results.filter((result) => result.delivery === "sent")).toHaveLength(
      1,
    );
    expect(
      results.filter((result) => result.delivery === "already-issued"),
    ).toHaveLength(3);
    expect(delivery.sendParticipantInvitation).toHaveBeenCalledTimes(1);
  });

  it("preserves duplicate issuance without resending or recovering the secret", async () => {
    const first = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
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
  });

  it("rotates newest-wins on reissue and rejects the superseded identity", async () => {
    const first = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    const second = await client.participantOnboarding.reissueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(second.invitationId).not.toBe(first.invitationId);
    expect(second.secret).not.toBe(first.secret);
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: first.invitationId,
          secret: first.secret!,
        },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPANT_INVITATION_CLOSED" },
    });
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: second.invitationId,
          secret: second.secret!,
        },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("closes on revoke and requires fresh issuance instead of reopening", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(
      await client.participantOnboarding.setInvitationOpen({
        invitationId: issued.invitationId,
        open: false,
      }),
    ).toEqual({ open: false });
    actor = recipient;
    const source = {
      kind: "invitation" as const,
      invitationId: issued.invitationId,
      secret: issued.secret!,
    };
    await expect(
      client.participantOnboarding.join({ ...joinProfile, source }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPANT_INVITATION_CLOSED" },
    });
    expect(await recipientMemberships()).toHaveLength(0);
    actor = owner;
    await expect(
      client.participantOnboarding.setInvitationOpen({
        invitationId: issued.invitationId,
        open: true,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const fresh = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(fresh.invitationId).not.toBe(issued.invitationId);
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: fresh.invitationId,
          secret: fresh.secret!,
        },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("rejects expired invitations without writes", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await db
      .update(entryTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(entryTokens.id, issued.invitationId));
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: issued.invitationId,
          secret: issued.secret!,
        },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPANT_INVITATION_EXPIRED" },
    });
    expect(await recipientMemberships()).toHaveLength(0);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(0);
  });

  it("keeps the grant durable across post-commit delivery failure and retries once", async () => {
    delivery.sendParticipantInvitation.mockRejectedValueOnce(
      new Error("SMTP unavailable"),
    );
    const failed = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(failed.delivery).toBe("failed");
    expect(
      (
        await db
          .select()
          .from(entryTokens)
          .where(eq(entryTokens.id, failed.invitationId))
      )[0]?.status,
    ).toBe("pending");
    const retried = await client.participantOnboarding.reissueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(retried.delivery).toBe("sent");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        ...joinProfile,
        source: {
          kind: "invitation",
          invitationId: retried.invitationId,
          secret: retried.secret!,
        },
      }),
    ).resolves.toHaveProperty("participationId");
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(1);
    expect(await recipientMemberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
  });

  it("repeats successful redemption idempotently", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    const source = {
      kind: "invitation" as const,
      invitationId: issued.invitationId,
      secret: issued.secret!,
    };
    const first = await client.participantOnboarding.join({
      ...joinProfile,
      source,
    });
    expect(
      await client.participantOnboarding.join({ ...joinProfile, source }),
    ).toEqual(first);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(1);
  });

  it("completes concurrent invitation joins with one participation and safe retry", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: "seed-invitation-coordinator@example.org",
    });
    actor = coordinatorInvitee;
    const input = {
      source: {
        kind: "invitation" as const,
        invitationId: issued.invitationId,
        secret: issued.secret!,
      },
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
  });

  it("completes identical joins through both entry flavours", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const throughLink = await client.participantOnboarding.join({
      ...joinProfile,
      source: { kind: "link", id: link.id, secret: link.secret },
    });
    expect(throughLink.participationId).toBeTruthy();
    const [linkParticipation] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, throughLink.participationId));
    expect(linkParticipation).toMatchObject({
      projectId: project,
      representedOrganizationId: partner,
      userId: recipient,
      email: recipientEmail,
      country: "LV",
    });
    // Reset for the invitation flavour with the same account and project.
    await db.delete(participants).where(eq(participants.projectId, project));
    await db.delete(member).where(eq(member.userId, recipient));
    await db.delete(profiles).where(eq(profiles.userId, recipient));
    await db.delete(acceptances).where(eq(acceptances.userId, recipient));
    actor = owner;
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    const throughInvitation = await client.participantOnboarding.join({
      ...joinProfile,
      source: {
        kind: "invitation",
        invitationId: issued.invitationId,
        secret: issued.secret!,
      },
    });
    expect(throughInvitation.participationId).toBeTruthy();
    const [invitationParticipation] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, throughInvitation.participationId));
    expect(invitationParticipation).toMatchObject({
      projectId: project,
      representedOrganizationId: partner,
      userId: recipient,
      email: recipientEmail,
      country: "LV",
    });
    expect(await recipientMemberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
  });

  it("keeps staff invitations in their organization and app invitations out of that list", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    const pending = await client.organizations.listPendingInvitations({});
    expect(pending.invitations).toHaveLength(1);
    expect(pending.invitations[0]).toMatchObject({
      email: "seed-entry-colleague@example.org",
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    const scoped = await client.participations.listPartnership({
      partnershipId: partnership,
    });
    expect(scoped.invitations).toEqual([
      {
        invitationId: issued.invitationId,
        email: recipientEmail,
        status: "pending",
      },
    ]);
  });
});
