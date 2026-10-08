// @vitest-environment node

import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  claimsTable,
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantProfilesTable as profiles,
  participantEntryTokensTable as entryTokens,
  partnerCoordinatorAssignmentsTable as assignments,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { ORPCError, createRouterClient } from "@orpc/server";
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
  addMember: vi.fn(),
  hasPermission: vi.fn(),
  grantParticipantMembership: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  // No $context: procedures must reach Membership writes only through the
  // supported auth.api surface, never through the internal adapter.
  auth: {
    api: authMocks,
  },
}));

import {
  costTrackerOrganizationRoles,
  parseOrganizationRoles,
} from "@greendex/auth";

import {
  createParticipantOnboardingProcedures,
  deliverParticipantInvitation,
} from "@/features/authentication/participant-onboarding-procedures";
import { requireCostTrackerRole } from "@/features/organizations/roles";
import { createParticipationProcedures } from "@/features/projects/procedures/participations";

const suffix = randomUUID();
const host = `onboarding-host-${suffix}`;
const partner = `onboarding-partner-${suffix}`;
const otherPartner = `onboarding-other-${suffix}`;
const project = `onboarding-project-${suffix}`;
const partnership = `onboarding-partnership-${suffix}`;
const otherPartnership = `onboarding-other-partnership-${suffix}`;
const owner = `onboarding-owner-${suffix}`;
const recipient = `onboarding-recipient-${suffix}`;
const recipientEmail = `recipient-${suffix}@example.org`;
let actor = owner;
let activeOrganizationId = partner;
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
  const now = new Date();
  await db.insert(user).values([
    {
      id: owner,
      name: "Owner",
      email: `owner-${suffix}@example.org`,
      emailVerified: true,
    },
    {
      id: recipient,
      name: "Recipient",
      email: recipientEmail,
      emailVerified: true,
    },
  ]);
  await db.insert(organization).values([
    { country: "DE", id: host, name: "Host", slug: host, createdAt: now },
    {
      country: "DE",
      id: partner,
      name: "Partner",
      slug: partner,
      createdAt: now,
    },
    {
      country: "DE",
      id: otherPartner,
      name: "Other partner",
      slug: otherPartner,
      createdAt: now,
    },
  ]);
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: partner,
    userId: owner,
    role: ORGANIZATION_ROLES.OrganizationOwner,
    createdAt: now,
  });
  await db.insert(projects).values({
    id: project,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV" as const,
    organizationId: host,
  });
  await db.insert(hostAssignments).values({ projectId: project, userId: owner });
  await db.insert(partnerships).values([
    { id: partnership, projectId: project, organizationId: partner },
    { id: otherPartnership, projectId: project, organizationId: otherPartner },
  ]);
});

beforeEach(async () => {
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(claimsTable).where(eq(claimsTable.partnershipId, partnership));
  await db.delete(member).where(eq(member.userId, recipient));
  actor = owner;
  activeOrganizationId = partner;
  version = { id: "fixture-agreement-v1", contentHash: "fixture-hash-v1" };
  vi.clearAllMocks();
  delivery.sendParticipantInvitation.mockResolvedValue(undefined);
  authMocks.getSession.mockImplementation(async () => ({
    user: {
      id: actor,
      name: actor === recipient ? "Recipient" : "Owner",
      email: actor === recipient ? recipientEmail : `owner-${suffix}@example.org`,
      emailVerified: true,
    },
    session: { id: randomUUID(), activeOrganizationId },
  }));
  // Faithful stand-in for the server-only participant-membership endpoint:
  // fresh read, idempotent resume, compare-and-swap on the expected role.
  authMocks.grantParticipantMembership.mockImplementation(
    async ({
      body,
    }: {
      body: { userId: string; organizationId: string; expectedRole: string };
    }) => {
      const [row] = await db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, body.userId),
            eq(member.organizationId, body.organizationId),
          ),
        )
        .limit(1);
      if (!row)
        return new Response(JSON.stringify({ code: "MEMBER_NOT_FOUND" }), {
          status: 400,
        });
      if (
        row.role
          .split(",")
          .map((value) => value.trim())
          .includes(ORGANIZATION_ROLES.Participant)
      )
        return new Response(JSON.stringify({ member: row }), { status: 200 });
      if (row.role !== body.expectedRole)
        return new Response(JSON.stringify({ code: "MEMBERSHIP_CHANGED" }), {
          status: 400,
        });
      const [updated] = await db
        .update(member)
        .set({ role: `${row.role},participant` })
        .where(and(eq(member.id, row.id), eq(member.role, row.role)))
        .returning();
      if (!updated)
        return new Response(JSON.stringify({ code: "MEMBERSHIP_CHANGED" }), {
          status: 400,
        });
      return new Response(JSON.stringify({ member: updated }), {
        status: 200,
      });
    },
  );
  authMocks.addMember.mockImplementation(
    async ({ body }: { body: { userId: string; organizationId: string } }) => {
      // Mirrors Better Auth's already-a-member refusal for competing joins.
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
        organizationId: host,
        userId: recipient,
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
});

afterAll(async () => {
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(entryTokens).where(eq(entryTokens.projectId, project));
  await db.delete(claimsTable).where(eq(claimsTable.partnershipId, partnership));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(member).where(eq(member.userId, recipient));
  await db.delete(member).where(eq(member.userId, owner));
  await db.delete(organization).where(eq(organization.id, otherPartner));
  await db.delete(organization).where(eq(organization.id, partner));
  await db.delete(organization).where(eq(organization.id, host));
  await db.delete(user).where(eq(user.id, recipient));
  await db.delete(user).where(eq(user.id, owner));
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
      code: "BAD_REQUEST",
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
        projectName: "Project",
        representedOrganizationName: "Partner",
        hostingOrganizationName: "Host",
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    await db.insert(entryTokens).values({
      partnershipId: otherPartnership,
      projectId: project,
      email: null,
      secretHash: createHash("sha256").update("other-secret").digest("hex"),
      expiresAt: null,
      issuedByUserId: owner,
    });
    const second = (
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.partnershipId, otherPartnership))
    )[0]!;
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: second.id, secret: "other-secret" },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "You already joined this Project through another Partner Organization.",
    });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: second.id, secret: second.secret },
        profile: { fullName: "Recipient", country: "LV" as const },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("blocks reopening registration after the Partnership's Claim is submitted", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    await client.participantOnboarding.setRegistrationLinkOpen({
      id: link.id,
      open: false,
    });
    await db
      .insert(claimsTable)
      .values({ partnershipId: partnership, status: "submitted" });
    await expect(
      client.participantOnboarding.setRegistrationLinkOpen({
        id: link.id,
        open: true,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
      await db.delete(member).where(eq(member.userId, recipient));
      await db.insert(member).values({
        id: randomUUID(),
        userId: recipient,
        organizationId: host,
        role,
        createdAt: new Date(),
      });
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
    await db.insert(member).values({
      id: randomUUID(),
      userId: recipient,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
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
    await db.insert(member).values({
      id: randomUUID(),
      userId: recipient,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
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
      code: "BAD_REQUEST",
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    const otherMembershipId = randomUUID();
    await db.insert(member).values({
      id: otherMembershipId,
      organizationId: otherPartner,
      userId: owner,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: new Date(),
    });
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
      await db.delete(member).where(eq(member.id, otherMembershipId));
    }
    activeOrganizationId = host;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: new Date(),
    });
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
      await db
        .delete(member)
        .where(and(eq(member.userId, owner), eq(member.organizationId, host)));
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
      code: "BAD_REQUEST",
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

  it("retries app writes after the membership grant but the app transaction failed", async () => {
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
    // Concurrent legacy email-only row forces the participation insert to fail after the grant.
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
      code: "BAD_REQUEST",
    });
    expect(await memberships()).toEqual([
      { role: ORGANIZATION_ROLES.Participant },
    ]);
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
    // The grant ran once; the retry reused the existing Membership.
    expect(authMocks.addMember).toHaveBeenCalledTimes(1);
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.projectId, project)),
    ).toHaveLength(1);
  });

  it("blocks an invitation to an already participating email", async () => {
    await db.insert(participants).values({
      projectId: project,
      representedOrganizationId: partner,
      displayName: "Recipient",
      userId: recipient,
      email: recipientEmail,
    });
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      await db
        .select()
        .from(entryTokens)
        .where(eq(entryTokens.projectId, project)),
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
    activeOrganizationId = host;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: new Date(),
    });
    try {
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
    } finally {
      await db
        .delete(member)
        .where(and(eq(member.userId, owner), eq(member.organizationId, host)));
    }
  });

  it("refuses a Hosting Project coordinator even when assigned to the Project", async () => {
    activeOrganizationId = host;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
    try {
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
    } finally {
      await db
        .delete(member)
        .where(and(eq(member.userId, owner), eq(member.organizationId, host)));
    }
  });

  it("denies a responsible User without the coordinator role", async () => {
    actor = recipient;
    activeOrganizationId = partner;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: partner,
      userId: recipient,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: new Date(),
    });
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "PARTNER_COORDINATION_REQUIRED" },
    });
    await db.delete(member).where(eq(member.userId, recipient));
  });

  it("denies unassigned issuers and cross-Partnership owners with no invitation side effects", async () => {
    activeOrganizationId = otherPartner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    actor = recipient;
    activeOrganizationId = partner;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: partner,
      userId: recipient,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: new Date(),
    });
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
    actor = recipient;
    activeOrganizationId = partner;
    const membershipId = randomUUID();
    await db.insert(member).values({
      id: membershipId,
      organizationId: partner,
      userId: recipient,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: new Date(),
    });
    await db
      .insert(assignments)
      .values({ partnershipId: partnership, userId: recipient });
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
            .where(eq(member.id, membershipId))
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
      await db
        .delete(assignments)
        .where(eq(assignments.partnershipId, partnership));
      await db.delete(member).where(eq(member.id, membershipId));
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
    const second = `onboarding-second-${suffix}`;
    const secondEmail = `second-${suffix}@example.org`;
    await db.insert(user).values({
      id: second,
      name: "Second",
      email: secondEmail,
      emailVerified: true,
    });
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
      authMocks.getSession.mockImplementation(async () => ({
        user: {
          id: second,
          name: "Second",
          email: secondEmail,
          emailVerified: true,
        },
        session: { id: randomUUID(), activeOrganizationId },
      }));
      authMocks.addMember.mockImplementationOnce(
        async ({
          body,
        }: {
          body: { userId: string; organizationId: string };
        }) => {
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
      await db.delete(user).where(eq(user.id, second));
    }
  });
});
