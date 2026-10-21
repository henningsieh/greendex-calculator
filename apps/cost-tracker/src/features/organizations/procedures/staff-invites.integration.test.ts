// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  session as sessionsTable,
  user,
  verification,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, like } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendOrganizationInvitation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({ emailSender: emailMocks }));
vi.mock("server-only", () => ({}));

import { INVALID_ROLE_MESSAGE } from "@/features/organizations/roles";
import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). Cost Tracker permits Organization
 * creation only for membership-free callers (single-Organization flag), so
 * the membership-free seed creator owns this file's creation lane (the
 * Organization-country suite owns the seed outsider lane; sharing one
 * memberless gate races under parallel files).
 * Invitations, acceptances, and role changes go through the supported
 * behavior as the action under test. Case Organizations, Memberships, and
 * invitations are removed afterwards; canonical actors are never deleted.
 * Case-only users (cancelled/expired invitees) still sign up through the
 * supported signup behavior and are tracked for cleanup.
 */
const SEED_CREATOR_EMAIL = "seed-creator@example.org";
const SEED_ADMIN_EMAIL = "seed-admin@example.org";
const SEED_PARTICIPANT_EMAIL = "seed-participant@example.org";
const SEED_ORG_SLUG = "seed-org";

const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];
const caseSessionTokens: string[] = [];
const createdUserIds: string[] = [];

function uniqueEmail(prefix: string) {
  const email = `staff-invite-${prefix}-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function cookieHeaders(cookie: string) {
  return new Headers({ cookie });
}

async function signUpVerified(name: string, email: string) {
  const password = "correct-horse-battery-staple";
  const signUp = await auth.api.signUpEmail({
    body: { email, name, password },
  });
  createdUserIds.push(signUp.user.id);
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, signUp.user.id));
  const response = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Sign-in did not create a session cookie");
  return cookieHeaders(cookie);
}

async function seedSession(email: string) {
  const stored = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!stored) throw new Error(`Seed user is missing: ${email}`);
  const response = await auth.api.signInEmail({
    body: { email, password: SEED_USER.password },
    returnHeaders: true,
  });
  caseSessionTokens.push(response.response.token);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("Sign-in did not create a session cookie");
  return cookieHeaders(cookie);
}

afterEach(async () => {
  for (const token of caseSessionTokens.splice(0)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  for (const email of createdEmails.splice(0)) {
    await db.delete(user).where(eq(user.email, email));
    await db
      .delete(verification)
      .where(like(verification.identifier, `%${email}%`));
  }
  for (const organizationId of createdOrganizationIds.splice(0)) {
    await db
      .delete(invitation)
      .where(eq(invitation.organizationId, organizationId));
    await db.delete(member).where(eq(member.organizationId, organizationId));
    await db.delete(organization).where(eq(organization.id, organizationId));
  }
  for (const userId of createdUserIds.splice(0)) {
    await db.delete(member).where(eq(member.userId, userId));
    await db.delete(user).where(eq(user.id, userId));
  }
  // Canonical actors survive every case: fail loudly on accidental deletion,
  // and the seed outsider stays membership-free for the next case creator.
  expect(
    await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    }),
    "canonical seed Organization was deleted",
  ).not.toBeUndefined();
  for (const email of [
    SEED_CREATOR_EMAIL,
    SEED_ADMIN_EMAIL,
    SEED_PARTICIPANT_EMAIL,
  ]) {
    expect(
      await db.query.user.findFirst({ where: eq(user.email, email) }),
      `canonical seed User was deleted: ${email}`,
    ).not.toBeUndefined();
  }
  const creator = await db.query.user.findFirst({
    where: eq(user.email, SEED_CREATOR_EMAIL),
  });
  expect(
    await db.query.member.findMany({
      where: eq(member.userId, creator!.id),
    }),
    "seed creator kept a case Membership",
  ).toEqual([]);
  vi.clearAllMocks();
});

describe("organizations staff invites (Better Auth underneath)", () => {
  it("refuses fallback invitations, additions, and role updates without persisting or sending mail", async () => {
    const ownerHeaders = await seedSession(SEED_CREATOR_EMAIL);
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Ban Org ${randomUUID()}`,
        slug: `ban-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);
    const owner = (await auth.api.getSession({ headers: ownerHeaders }))!.user;
    const targetEmail = `staff-invite-ban-target-${randomUUID()}@example.com`;
    const targetHeaders = await seedSession(SEED_PARTICIPANT_EMAIL);
    const target = (await auth.api.getSession({ headers: targetHeaders }))!.user;
    const updateHeaders = await seedSession(SEED_ADMIN_EMAIL);
    const updateTarget = (await auth.api.getSession({ headers: updateHeaders }))!
      .user;
    const updateMembership = await auth.api.addMember({
      body: {
        organizationId: created.id,
        userId: updateTarget.id,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      },
    });
    const ownerClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });
    // Deliberately send invalid runtime values past the compile-time role union.
    for (const role of [
      "invalid-role",
      `${ORGANIZATION_ROLES.OrganizationOwner},invalid-role`,
    ] as const) {
      await expect(
        auth.api.createInvitation({
          body: {
            organizationId: created.id,
            email: targetEmail,
            role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
          },
          headers: ownerHeaders,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { message: INVALID_ROLE_MESSAGE },
      });
      await expect(
        auth.api.addMember({
          body: {
            organizationId: created.id,
            userId: target.id,
            role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
          },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { message: INVALID_ROLE_MESSAGE },
      });
      await expect(
        auth.api.updateMemberRole({
          body: {
            organizationId: created.id,
            memberId: updateMembership!.id,
            role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
          },
          headers: ownerHeaders,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        ownerClient.organizations.inviteMember({
          email: targetEmail,
          role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    // Better Auth's input schema requires a role before our hook; no default is assigned.
    await expect(
      auth.api.addMember({
        body: {
          organizationId: created.id,
          userId: target.id,
          role: undefined as unknown as typeof ORGANIZATION_ROLES.OrganizationAdmin,
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      body: { message: expect.stringContaining("[body.role] Invalid input") },
    });
    expect(
      await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(eq(invitation.organizationId, created.id)),
    ).toEqual([]);
    expect(
      await db
        .select({ userId: member.userId, role: member.role })
        .from(member)
        .where(eq(member.organizationId, created.id)),
    ).toEqual(
      expect.arrayContaining([
        { userId: owner.id, role: ORGANIZATION_ROLES.OrganizationOwner },
        { userId: updateTarget.id, role: ORGANIZATION_ROLES.OrganizationAdmin },
      ]),
    );
    expect(
      await db
        .select({ id: member.id })
        .from(member)
        .where(eq(member.organizationId, created.id)),
    ).toHaveLength(2);
    expect(emailMocks.sendOrganizationInvitation).not.toHaveBeenCalled();
  }, 30_000);

  it("refuses native resends before expiry updates or mail, including legacy pending roles", async () => {
    const headers = await seedSession(SEED_CREATOR_EMAIL);
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Resend Org ${randomUUID()}`,
        slug: `resend-${randomUUID()}`,
      },
      headers,
    });
    createdOrganizationIds.push(created.id);
    const email = uniqueEmail("resend-target");
    const pending = await auth.api.createInvitation({
      body: {
        organizationId: created.id,
        email,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      },
      headers,
    });
    const expiresAt = new Date(Date.now() + 60_000);
    await db
      .update(invitation)
      .set({ expiresAt })
      .where(eq(invitation.id, pending.id));
    emailMocks.sendOrganizationInvitation.mockClear();
    for (const role of [
      "invalid-role",
      [ORGANIZATION_ROLES.OrganizationAdmin, "invalid-role"],
    ]) {
      await expect(
        auth.api.createInvitation({
          body: {
            organizationId: created.id,
            email,
            role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
            resend: true,
          },
          headers,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { message: INVALID_ROLE_MESSAGE },
      });
    }
    // Model a legacy pending row in-memory only: never seed a forbidden value.
    const authContext = await auth.$context;
    const pendingRead = vi
      .spyOn(authContext.adapter, "findMany")
      .mockResolvedValueOnce([{ ...pending, expiresAt, role: "invalid-role" }]);
    try {
      await expect(
        auth.api.createInvitation({
          body: {
            organizationId: created.id,
            email,
            role: ORGANIZATION_ROLES.OrganizationAdmin,
            resend: true,
          },
          headers,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        body: { message: INVALID_ROLE_MESSAGE },
      });
      expect(pendingRead).toHaveBeenCalledWith(
        expect.objectContaining({ model: "invitation" }),
      );
    } finally {
      pendingRead.mockRestore();
    }
    expect(
      (
        await db
          .select({ role: invitation.role, expiresAt: invitation.expiresAt })
          .from(invitation)
          .where(eq(invitation.id, pending.id))
      )[0],
    ).toEqual({ role: ORGANIZATION_ROLES.OrganizationAdmin, expiresAt });
    expect(emailMocks.sendOrganizationInvitation).not.toHaveBeenCalled();
    await auth.api.createInvitation({
      body: {
        organizationId: created.id,
        email,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        resend: true,
      },
      headers,
    });
    expect(emailMocks.sendOrganizationInvitation).toHaveBeenCalledTimes(1);
    expect(
      (
        await db
          .select({ expiresAt: invitation.expiresAt })
          .from(invitation)
          .where(eq(invitation.id, pending.id))
      )[0]!.expiresAt.getTime(),
    ).toBeGreaterThan(expiresAt.getTime());
  }, 30_000);

  it("invites, accepts with the exact role, and cancels pending invites", async () => {
    const ownerHeaders = await seedSession(SEED_CREATOR_EMAIL);
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Staff Org ${randomUUID()}`,
        slug: `staff-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);

    const session = await auth.api.getSession({ headers: ownerHeaders });
    expect(session?.session.activeOrganizationId).toBe(created.id);

    const ownerClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });

    const memberEmail = SEED_ADMIN_EMAIL;
    const invited = await ownerClient.organizations.inviteMember({
      email: memberEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    expect(invited).toMatchObject({
      email: memberEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    expect(emailMocks.sendOrganizationInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: memberEmail }),
    );

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, invited.invitationId));
    expect(stored).toMatchObject({
      organizationId: created.id,
      email: memberEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
      status: "pending",
    });

    const pending = await ownerClient.organizations.listPendingInvitations({});
    expect(pending.invitations.map((entry) => entry.id)).toContain(
      invited.invitationId,
    );

    const memberHeaders = await seedSession(memberEmail);
    await expect(
      ownerClient.organizations.listMembers({}),
    ).resolves.toBeDefined();
    const wrongClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });
    await expect(
      wrongClient.organizations.acceptInvitation({
        invitationId: invited.invitationId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const memberClient = createRouterClient(router, {
      context: async () => ({ headers: memberHeaders }),
    });
    await expect(
      memberClient.organizations.acceptInvitation({
        invitationId: invited.invitationId,
      }),
    ).resolves.toEqual({ organizationId: created.id });
    const [accepted] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, created.id),
          eq(
            member.userId,
            (await auth.api.getSession({ headers: memberHeaders }))!.user.id,
          ),
        ),
      );
    expect(accepted.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);

    const members = await ownerClient.organizations.listMembers({});
    expect(
      members.members.find((entry) => entry.email === memberEmail),
    ).toMatchObject({ role: ORGANIZATION_ROLES.OrganizationAdmin });

    const cancelledEmail = uniqueEmail("cancelled");
    const cancelled = await ownerClient.organizations.inviteMember({
      email: cancelledEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    await expect(
      ownerClient.organizations.cancelInvitation({
        invitationId: cancelled.invitationId,
      }),
    ).resolves.toEqual({ success: true });

    const [removed] = await db
      .select({ status: invitation.status })
      .from(invitation)
      .where(eq(invitation.id, cancelled.invitationId));
    expect(removed?.status).toBe("canceled");

    const cancelledHeaders = await signUpVerified(
      "Cancelled User",
      cancelledEmail,
    );
    const cancelledClient = createRouterClient(router, {
      context: async () => ({ headers: cancelledHeaders }),
    });
    await expect(
      cancelledClient.organizations.acceptInvitation({
        invitationId: cancelled.invitationId,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const expiredEmail = uniqueEmail("expired");
    const expiredInvite = await ownerClient.organizations.inviteMember({
      email: expiredEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    await db
      .update(invitation)
      .set({ expiresAt: new Date(0) })
      .where(eq(invitation.id, expiredInvite.invitationId));
    const expiredHeaders = await signUpVerified("Expired User", expiredEmail);
    const expiredClient = createRouterClient(router, {
      context: async () => ({ headers: expiredHeaders }),
    });
    await expect(
      expiredClient.organizations.acceptInvitation({
        invitationId: expiredInvite.invitationId,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Organization Invitation has expired.",
    });

    const pendingAfter = await ownerClient.organizations.listPendingInvitations(
      {},
    );
    expect(pendingAfter.invitations.map((entry) => entry.id)).not.toContain(
      cancelled.invitationId,
    );
    // Slow auth/crypto flow: flakes at the 5s default under full parallel load.
  }, 30_000);

  it("rejects Participant Invitations through the staff acceptance action", async () => {
    const ownerHeaders = await seedSession(SEED_CREATOR_EMAIL);
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Bypass Org ${randomUUID()}`,
        slug: `bypass-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);
    const owner = await auth.api.getSession({ headers: ownerHeaders });
    const inviteeEmail = SEED_PARTICIPANT_EMAIL;
    const [planted] = await db
      .insert(invitation)
      .values({
        id: randomUUID(),
        organizationId: created.id,
        email: inviteeEmail,
        role: ORGANIZATION_ROLES.Participant,
        status: "pending",
        expiresAt: new Date(Date.now() + 3600_000),
        inviterId: owner!.user.id,
      })
      .returning({ id: invitation.id });
    const inviteeHeaders = await seedSession(inviteeEmail);
    const inviteeClient = createRouterClient(router, {
      context: async () => ({ headers: inviteeHeaders }),
    });
    await expect(
      inviteeClient.organizations.acceptInvitation({
        invitationId: planted.id,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This invitation is not an Organization staff invitation.",
    });
  });

  it("lets an admin invite admins but never owners", async () => {
    const ownerHeaders = await seedSession(SEED_CREATOR_EMAIL);
    const created = await auth.api.createOrganization({
      body: {
        country: "DE" as const,
        name: `Admin Org ${randomUUID()}`,
        slug: `admin-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);

    const adminEmail = SEED_ADMIN_EMAIL;
    const ownerClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });
    const adminInvite = await ownerClient.organizations.inviteMember({
      email: adminEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    const adminHeaders = await seedSession(adminEmail);
    await auth.api.acceptInvitation({
      body: { invitationId: adminInvite.invitationId },
      headers: adminHeaders,
    });

    const adminClient = createRouterClient(router, {
      context: async () => ({ headers: adminHeaders }),
    });
    const targetEmail = uniqueEmail("target");
    const targetInvite = await adminClient.organizations.inviteMember({
      email: targetEmail,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
    expect(targetInvite.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);

    await expect(
      adminClient.organizations.inviteMember({
        email: uniqueEmail("escalation"),
        role: ORGANIZATION_ROLES.OrganizationOwner,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const [stored] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, created.id),
          eq(
            member.userId,
            (await auth.api.getSession({ headers: adminHeaders }))!.user.id,
          ),
        ),
      );
    expect(stored?.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
  });
});
