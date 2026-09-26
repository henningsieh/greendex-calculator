// @vitest-environment node

import { createHash, randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  claimsTable,
  invitation,
  member,
  organization,
  participantAgreementAcceptancesTable as acceptances,
  participantInvitationBridgesTable as bridges,
  participantProfilesTable as profiles,
  participantRegistrationLinksTable as links,
  partnerCoordinatorAssignmentsTable as assignments,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
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

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  addMember: vi.fn(),
  acceptInvitation: vi.fn(),
  createInvitation: vi.fn(),
  update: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: authMocks,
    get $context() {
      return Promise.resolve({ adapter: { update: authMocks.update } });
    },
  },
}));

import { createParticipantOnboardingProcedures } from "@/features/authentication/participant-onboarding-procedures";

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
  { participantOnboarding: createParticipantOnboardingProcedures(() => version) },
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
    { id: host, name: "Host", slug: host, createdAt: now },
    { id: partner, name: "Partner", slug: partner, createdAt: now },
    {
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
    role: "owner",
    createdAt: now,
  });
  await db.insert(projects).values({
    id: project,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    responsibleUserId: owner,
    organizationId: host,
  });
  await db.insert(partnerships).values([
    { id: partnership, projectId: project, organizationId: partner },
    { id: otherPartnership, projectId: project, organizationId: otherPartner },
  ]);
});

beforeEach(async () => {
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(bridges).where(eq(bridges.projectId, project));
  await db.delete(links).where(eq(links.partnershipId, partnership));
  await db.delete(links).where(eq(links.partnershipId, otherPartnership));
  await db.delete(invitation).where(eq(invitation.organizationId, host));
  await db.delete(claimsTable).where(eq(claimsTable.partnershipId, partnership));
  await db.delete(member).where(eq(member.userId, recipient));
  actor = owner;
  activeOrganizationId = partner;
  version = { id: "fixture-agreement-v1", contentHash: "fixture-hash-v1" };
  vi.clearAllMocks();
  authMocks.getSession.mockImplementation(async () => ({
    user: {
      id: actor,
      name: actor === recipient ? "Recipient" : "Owner",
      email: actor === recipient ? recipientEmail : `owner-${suffix}@example.org`,
      emailVerified: true,
    },
    session: { id: randomUUID(), activeOrganizationId },
  }));
  authMocks.update.mockImplementation(
    async ({
      where,
      update,
    }: {
      where: { value: string }[];
      update: { role: string };
    }) => {
      const [row] = await db
        .update(member)
        .set(update)
        .where(
          and(eq(member.id, where[0]!.value), eq(member.role, where[1]!.value)),
        )
        .returning();
      return row ?? null;
    },
  );
  authMocks.addMember.mockImplementation(async () => {
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: recipient,
      role: "participant",
      createdAt: new Date(),
    });
    return new Response(null, { status: 200 });
  });
  authMocks.acceptInvitation.mockImplementation(
    async ({ body }: { body: { invitationId: string } }) => {
      await db
        .update(invitation)
        .set({ status: "accepted" })
        .where(eq(invitation.id, body.invitationId));
      await db.insert(member).values({
        id: randomUUID(),
        organizationId: host,
        userId: recipient,
        role: "participant",
        createdAt: new Date(),
      });
      return new Response(null, { status: 200 });
    },
  );
});

afterAll(async () => {
  await db.delete(acceptances).where(eq(acceptances.userId, recipient));
  await db.delete(profiles).where(eq(profiles.userId, recipient));
  await db.delete(participants).where(eq(participants.projectId, project));
  await db.delete(bridges).where(eq(bridges.projectId, project));
  await db.delete(links).where(eq(links.partnershipId, partnership));
  await db.delete(links).where(eq(links.partnershipId, otherPartnership));
  await db.delete(invitation).where(eq(invitation.organizationId, host));
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
  it("joins through a reusable link, gates Projects on the current agreement, and preserves earlier acceptance", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    activeOrganizationId = undefined as unknown as string;
    const joined = await client.participantOnboarding.join({
      source: { kind: "link", id: link.id, secret: link.secret },
      profile: { fullName: "Recipient" },
      agreement: { accepted: true },
    });
    expect(joined.participationId).toBeTruthy();
    expect(await memberships()).toEqual([{ role: "participant" }]);
    expect(await client.participantOnboarding.listMyProjects()).toEqual([
      {
        participationId: joined.participationId,
        projectId: project,
        projectName: "Project",
      },
    ]);
    version = { id: "fixture-agreement-v2", contentHash: "fixture-hash-v2" };
    await expect(
      client.participantOnboarding.listMyProjects(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
        profile: { fullName: "Recipient" },
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
      profile: { fullName: "Recipient" },
      agreement: { accepted: true },
    });
    // A second partner's link is never authority to replace a previous Participation.
    await db.insert(links).values({
      partnershipId: otherPartnership,
      secretHash: createHash("sha256").update("other-secret").digest("hex"),
      createdByUserId: owner,
    });
    const second = (
      await db
        .select()
        .from(links)
        .where(eq(links.partnershipId, otherPartnership))
    )[0]!;
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "link", id: second.id, secret: "other-secret" },
        profile: { fullName: "Recipient" },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "You already joined this Project through another Partner Organization.",
    });
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
      (await db.select().from(links).where(eq(links.id, link.id)))[0]?.enabled,
    ).toBe(false);
  });

  it("keeps existing owner/admin/participant roles, and grants participant to a plain member only", async () => {
    const link = await client.participantOnboarding.createRegistrationLink({
      partnershipId: partnership,
    });
    actor = recipient;
    const join = () =>
      client.participantOnboarding.join({
        source: { kind: "link" as const, id: link.id, secret: link.secret },
        profile: { fullName: "Recipient" },
        agreement: { accepted: true as const },
      });
    for (const role of ["owner", "admin", "participant", "member"]) {
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
        { role: role === "member" ? "member,participant" : role },
      ]);
    }
    expect(authMocks.addMember).not.toHaveBeenCalled();
    expect(authMocks.update).toHaveBeenCalledTimes(1);
  });

  it("cancels the native invitation on revoke and requires re-issue to recover", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await client.participantOnboarding.setInvitationOpen({
      invitationId: issued.invitationId,
      open: false,
    });
    const [native] = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(eq(invitation.id, issued.invitationId));
    expect(native?.status).toBe("canceled");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "invitation", invitationId: issued.invitationId },
        profile: { fullName: "Recipient" },
        agreement: { accepted: true },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(authMocks.acceptInvitation).not.toHaveBeenCalled();
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
        source: { kind: "invitation", invitationId: reissued.invitationId },
        profile: { fullName: "Recipient" },
        agreement: { accepted: true },
      }),
    ).resolves.toHaveProperty("participationId");
  });

  it("retires a stale bridge and issues fresh when the native invitation expired", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitation.id, issued.invitationId));
    const fresh = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(fresh.invitationId).not.toBe(issued.invitationId);
    const [retired] = await db
      .select({ status: bridges.status })
      .from(bridges)
      .where(eq(bridges.invitationId, issued.invitationId));
    expect(retired?.status).toBe("revoked");
    actor = recipient;
    await expect(
      client.participantOnboarding.join({
        source: { kind: "invitation", invitationId: fresh.invitationId },
        profile: { fullName: "Recipient" },
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
        profile: { fullName: "Recipient" },
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

  it("does not write profile, acceptance or Participation if BA acceptance fails, and retry succeeds", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    authMocks.acceptInvitation.mockResolvedValueOnce(
      new Response(null, { status: 403 }),
    );
    const input = {
      source: { kind: "invitation" as const, invitationId: issued.invitationId },
      profile: { fullName: "Recipient" },
      agreement: { accepted: true as const },
    };
    await expect(client.participantOnboarding.join(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
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

  it("retries app writes after BA accepted but the app transaction failed", async () => {
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    actor = recipient;
    const input = {
      source: { kind: "invitation" as const, invitationId: issued.invitationId },
      profile: { fullName: "Recipient" },
      agreement: { accepted: true as const },
    };
    // Concurrent legacy email-only row forces the participation insert to fail after BA accepts.
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
    expect(await memberships()).toEqual([{ role: "participant" }]);
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
    expect(authMocks.acceptInvitation).toHaveBeenCalledTimes(1);
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
      await db.select().from(bridges).where(eq(bridges.projectId, project)),
    ).toHaveLength(0);
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

  it("allows Hosting staff to issue through Better Auth, not a direct invitation insert", async () => {
    activeOrganizationId = host;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: "owner",
      createdAt: new Date(),
    });
    const invitationId = randomUUID();
    authMocks.createInvitation.mockImplementationOnce(async () => {
      await db.insert(invitation).values({
        id: invitationId,
        organizationId: host,
        email: recipientEmail,
        role: "participant",
        inviterId: owner,
        expiresAt: new Date(Date.now() + 3600000),
      });
      return Response.json({ id: invitationId });
    });
    const result = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(authMocks.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: recipientEmail,
          role: "participant",
          organizationId: host,
        },
      }),
    );
    expect(
      (
        await db
          .select()
          .from(bridges)
          .where(eq(bridges.invitationId, result.invitationId))
      )[0]?.partnershipId,
    ).toBe(partnership);
    await db.delete(bridges).where(eq(bridges.invitationId, result.invitationId));
    await db.delete(invitation).where(eq(invitation.id, result.invitationId));
    await db
      .delete(member)
      .where(and(eq(member.userId, owner), eq(member.organizationId, host)));
  });

  it("lets the Project responsible User issue when they hold only a plain Hosting Membership", async () => {
    activeOrganizationId = host;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: host,
      userId: owner,
      role: "member",
      createdAt: new Date(),
    });
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: recipientEmail,
    });
    expect(
      (
        await db
          .select()
          .from(invitation)
          .where(eq(invitation.id, issued.invitationId))
      )[0]?.organizationId,
    ).toBe(host);
    expect(authMocks.createInvitation).not.toHaveBeenCalled();
    await db
      .delete(member)
      .where(and(eq(member.userId, owner), eq(member.organizationId, host)));
  });

  it("denies unassigned issuers and cross-Partnership owners with no invitation side effects", async () => {
    activeOrganizationId = otherPartner;
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    actor = recipient;
    activeOrganizationId = partner;
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: partner,
      userId: recipient,
      role: "member",
      createdAt: new Date(),
    });
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      await db.select().from(bridges).where(eq(bridges.projectId, project)),
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
      role: "member",
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
            .select({ partnershipId: bridges.partnershipId })
            .from(bridges)
            .where(eq(bridges.invitationId, issued.invitationId))
        )[0]?.partnershipId,
      ).toBe(partnership);
      expect(
        (
          await db
            .select({ role: member.role })
            .from(member)
            .where(eq(member.id, membershipId))
        )[0]?.role,
      ).toBe("member");
      await expect(
        client.participantOnboarding.issueInvitation({
          partnershipId: otherPartnership,
          email: `another-${suffix}@example.org`,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      await db.delete(bridges).where(eq(bridges.projectId, project));
      await db.delete(invitation).where(eq(invitation.organizationId, host));
      await db
        .delete(assignments)
        .where(eq(assignments.partnershipId, partnership));
      await db.delete(member).where(eq(member.id, membershipId));
    }
  });

  it("issues and consumes a native BA invitation via its app bridge, then retries without duplicate Participation", async () => {
    actor = owner;
    const issued = await client.participantOnboarding.issueInvitation({
      partnershipId: partnership,
      email: `  ${recipientEmail.toUpperCase()}  `,
    });
    expect(
      await client.participantOnboarding.issueInvitation({
        partnershipId: partnership,
        email: recipientEmail,
      }),
    ).toEqual(issued);
    const [native] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, issued.invitationId));
    expect(native).toMatchObject({
      organizationId: host,
      email: recipientEmail,
      role: "participant",
      status: "pending",
      inviterId: owner,
    });
    actor = recipient;
    const input = {
      source: { kind: "invitation" as const, invitationId: issued.invitationId },
      profile: { fullName: "Recipient" },
      agreement: { accepted: true as const },
    };
    const first = await client.participantOnboarding.join(input);
    expect(await client.participantOnboarding.join(input)).toEqual(first);
    expect(authMocks.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(
      (
        await db
          .select()
          .from(bridges)
          .where(eq(bridges.invitationId, issued.invitationId))
      )[0]?.status,
    ).toBe("accepted");
    expect(await memberships()).toEqual([{ role: "participant" }]);
  });
});
