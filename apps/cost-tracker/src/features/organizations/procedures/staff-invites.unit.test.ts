// @vitest-environment node

import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const orgId = `staff-org-${suffix}`;
const ownerId = `staff-owner-${suffix}`;
const adminId = `staff-admin-${suffix}`;
const memberId = `staff-member-${suffix}`;
const participantId = `staff-participant-${suffix}`;
const outsiderId = `staff-outsider-${suffix}`;
const hybridAdminId = `staff-hybrid-admin-${suffix}`;
const hybridMemberId = `staff-hybrid-member-${suffix}`;

const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function session(userId: string, activeOrganizationId: string | null = orgId) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: { id: userId, name: userId, email: `${userId}@example.org` },
  });
}

async function invitationStatus(id: string) {
  const [row] = await db
    .select({ status: invitation.status })
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);
  return row?.status;
}

describe("organizations staff invites", () => {
  beforeAll(async () => {
    const now = new Date();
    await db.insert(organization).values({
      id: orgId,
      name: orgId,
      slug: orgId,
      createdAt: now,
    });
    const users = [
      ownerId,
      adminId,
      memberId,
      participantId,
      outsiderId,
      hybridAdminId,
      hybridMemberId,
    ];
    for (const id of users) {
      await db.insert(user).values({
        id,
        name: id,
        email: `${id}@example.org`,
        emailVerified: true,
      });
    }
    const memberships: [string, string][] = [
      [ownerId, "owner"],
      [adminId, "admin"],
      [memberId, "project-coordinator"],
      [participantId, "participant"],
      [hybridAdminId, "admin,participant"],
      [hybridMemberId, "project-coordinator,participant"],
    ];
    for (const [userId, role] of memberships) {
      await db.insert(member).values({
        id: randomUUID(),
        userId,
        organizationId: orgId,
        role,
        createdAt: now,
      });
    }
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await db.delete(invitation).where(eq(invitation.organizationId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    for (const id of [
      ownerId,
      adminId,
      memberId,
      participantId,
      outsiderId,
      hybridAdminId,
      hybridMemberId,
    ]) {
      await db.delete(user).where(eq(user.id, id));
    }
  });

  it("denies the member list to members, participants, and outsiders", async () => {
    for (const userId of [memberId, participantId, outsiderId]) {
      session(userId);
      await expect(client.organizations.listMembers({})).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    session(memberId, null);
    await expect(client.organizations.listMembers({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("lists members with combined roles for owners and admins", async () => {
    session(ownerId);
    const asOwner = await client.organizations.listMembers({});
    expect(asOwner.members.map((entry) => entry.role).sort()).toEqual(
      [
        "admin",
        "admin,participant",
        "project-coordinator",
        "project-coordinator,participant",
        "owner",
        "participant",
      ].sort(),
    );
    expect(asOwner.members[0]).toMatchObject({
      email: expect.stringContaining("@example.org"),
      name: expect.any(String),
    });

    session(hybridAdminId);
    await expect(client.organizations.listMembers({})).resolves.toMatchObject({
      members: expect.any(Array),
    });

    session(hybridMemberId);
    await expect(client.organizations.listMembers({})).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("denies pending-invitation reads and cancellations to non-managers", async () => {
    for (const userId of [memberId, participantId, outsiderId]) {
      session(userId);
      await expect(
        client.organizations.listPendingInvitations({}),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        client.organizations.cancelInvitation({ invitationId: randomUUID() }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("denies invites from non-managers and above-role grants", async () => {
    session(memberId);
    await expect(
      client.organizations.inviteMember({
        email: "new-member@example.org",
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    session(adminId);
    await expect(
      client.organizations.inviteMember({
        email: "new-owner@example.org",
        role: "owner",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authMocks.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects coordinator and participant roles even for owners", async () => {
    session(ownerId);
    for (const role of [
      "project-coordinator",
      "participant",
      "owner,participant",
    ]) {
      await expect(
        client.organizations.inviteMember({
          email: "staff-target@example.org",
          role: role as "admin",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(authMocks.createInvitation).not.toHaveBeenCalled();
  });

  it("invites with the exact requested role within the inviter's rank", async () => {
    const invitationId = randomUUID();
    authMocks.createInvitation.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: invitationId }),
    });

    session(adminId);
    await expect(
      client.organizations.inviteMember({
        email: "New-Admin@Example.org",
        role: "admin",
      }),
    ).resolves.toMatchObject({ invitationId, role: "admin" });
    expect(authMocks.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "new-admin@example.org",
          role: "admin",
          organizationId: orgId,
        }),
      }),
    );

    authMocks.createInvitation.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: randomUUID() }),
    });
    session(ownerId);
    await expect(
      client.organizations.inviteMember({
        email: "new-owner@example.org",
        role: "owner",
      }),
    ).resolves.toMatchObject({ role: "owner" });
  });

  it("cancels a pending invitation and rejects unknown or settled rows", async () => {
    const pendingId = randomUUID();
    const otherOrgId = `staff-other-org-${suffix}`;
    const otherInvitationId = randomUUID();
    const now = new Date();
    await db.insert(organization).values({
      id: otherOrgId,
      name: otherOrgId,
      slug: otherOrgId,
      createdAt: now,
    });
    await db.insert(invitation).values([
      {
        id: pendingId,
        organizationId: orgId,
        email: "leaving@example.org",
        role: "admin",
        status: "pending",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
        inviterId: ownerId,
      },
      {
        id: otherInvitationId,
        organizationId: otherOrgId,
        email: "elsewhere@example.org",
        role: "admin",
        status: "pending",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
        inviterId: ownerId,
      },
    ]);
    try {
      session(ownerId);
      const pending = await client.organizations.listPendingInvitations({});
      expect(pending.invitations.map((entry) => entry.id)).toContain(pendingId);
      expect(pending.invitations.map((entry) => entry.id)).not.toContain(
        otherInvitationId,
      );

      await expect(
        client.organizations.cancelInvitation({
          invitationId: otherInvitationId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });

      authMocks.cancelInvitation.mockResolvedValueOnce({ id: pendingId });
      await expect(
        client.organizations.cancelInvitation({ invitationId: pendingId }),
      ).resolves.toEqual({ success: true });
      expect(authMocks.cancelInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { invitationId: pendingId },
        }),
      );

      await db
        .update(invitation)
        .set({ status: "accepted" })
        .where(eq(invitation.id, pendingId));
      expect(await invitationStatus(pendingId)).toBe("accepted");
      await expect(
        client.organizations.cancelInvitation({ invitationId: pendingId }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        client.organizations.cancelInvitation({
          invitationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    } finally {
      await db.delete(invitation).where(eq(invitation.id, pendingId));
      await db.delete(invitation).where(eq(invitation.id, otherInvitationId));
      await db.delete(organization).where(eq(organization.id, otherOrgId));
    }
  });
});
