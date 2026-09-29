// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
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

import { auth } from "@/lib/auth";
import { router } from "@/lib/orpc/router";

const createdEmails: string[] = [];
const createdOrganizationIds: string[] = [];
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

afterEach(async () => {
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
  vi.clearAllMocks();
});

describe("organizations staff invites (Better Auth underneath)", () => {
  it("invites, accepts with the exact role, and cancels pending invites", async () => {
    const ownerEmail = uniqueEmail("owner");
    const ownerHeaders = await signUpVerified("Staff Owner", ownerEmail);
    const created = await auth.api.createOrganization({
      body: { name: `Staff Org ${randomUUID()}`, slug: `staff-${randomUUID()}` },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);

    const session = await auth.api.getSession({ headers: ownerHeaders });
    expect(session?.session.activeOrganizationId).toBe(created.id);

    const ownerClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });

    const memberEmail = uniqueEmail("member");
    const invited = await ownerClient.organizations.inviteMember({
      email: memberEmail,
      role: "member",
    });
    expect(invited).toMatchObject({ email: memberEmail, role: "member" });
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
      role: "member",
      status: "pending",
    });

    const pending = await ownerClient.organizations.listPendingInvitations({});
    expect(pending.invitations.map((entry) => entry.id)).toContain(
      invited.invitationId,
    );

    const memberHeaders = await signUpVerified("Staff Member", memberEmail);
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
    expect(accepted.role).toBe("member");

    const members = await ownerClient.organizations.listMembers({});
    expect(
      members.members.find((entry) => entry.email === memberEmail),
    ).toMatchObject({ role: "member" });

    const cancelledEmail = uniqueEmail("cancelled");
    const cancelled = await ownerClient.organizations.inviteMember({
      email: cancelledEmail,
      role: "admin",
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
      role: "member",
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
    const ownerEmail = uniqueEmail("bypass-owner");
    const ownerHeaders = await signUpVerified("Bypass Owner", ownerEmail);
    const created = await auth.api.createOrganization({
      body: {
        name: `Bypass Org ${randomUUID()}`,
        slug: `bypass-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);
    const owner = await auth.api.getSession({ headers: ownerHeaders });
    const inviteeEmail = uniqueEmail("invitee");
    const [planted] = await db
      .insert(invitation)
      .values({
        id: randomUUID(),
        organizationId: created.id,
        email: inviteeEmail,
        role: "participant",
        status: "pending",
        expiresAt: new Date(Date.now() + 3600_000),
        inviterId: owner!.user.id,
      })
      .returning({ id: invitation.id });
    const inviteeHeaders = await signUpVerified("Invitee", inviteeEmail);
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

  it("lets an admin invite members but never owners", async () => {
    const ownerEmail = uniqueEmail("admin-owner");
    const ownerHeaders = await signUpVerified("Admin Owner", ownerEmail);
    const created = await auth.api.createOrganization({
      body: {
        name: `Admin Org ${randomUUID()}`,
        slug: `admin-${randomUUID()}`,
      },
      headers: ownerHeaders,
    });
    createdOrganizationIds.push(created.id);

    const adminEmail = uniqueEmail("admin");
    const ownerClient = createRouterClient(router, {
      context: async () => ({ headers: ownerHeaders }),
    });
    const adminInvite = await ownerClient.organizations.inviteMember({
      email: adminEmail,
      role: "admin",
    });
    const adminHeaders = await signUpVerified("Staff Admin", adminEmail);
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
      role: "member",
    });
    expect(targetInvite.role).toBe("member");

    await expect(
      adminClient.organizations.inviteMember({
        email: uniqueEmail("escalation"),
        role: "owner",
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
    expect(stored?.role).toBe("admin");
  });
});
