// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
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
    await db.insert(organization).values({ country: "DE",
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
      [ownerId, ORGANIZATION_ROLES.OrganizationOwner],
      [adminId, ORGANIZATION_ROLES.OrganizationAdmin],
      [memberId, ORGANIZATION_ROLES.ProjectCoordinator],
      [participantId, ORGANIZATION_ROLES.Participant],
      [hybridAdminId, `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`],
      [hybridMemberId, `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`],
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
      code: "BAD_REQUEST",
      status: 400,
      message:
        "Select an active Organization before accessing Cost Tracker data.",
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
  });

  it("lists members with combined roles for owners and admins", async () => {
    session(ownerId);
    const asOwner = await client.organizations.listMembers({});
    expect(asOwner.members.map((entry) => entry.role).sort()).toEqual(
      [
        ORGANIZATION_ROLES.OrganizationAdmin,
        `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`,
        ORGANIZATION_ROLES.ProjectCoordinator,
        `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
        ORGANIZATION_ROLES.OrganizationOwner,
        ORGANIZATION_ROLES.Participant,
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
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    session(adminId);
    await expect(
      client.organizations.inviteMember({
        email: "new-owner@example.org",
        role: ORGANIZATION_ROLES.OrganizationOwner,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authMocks.createInvitation).not.toHaveBeenCalled();
  });

  it("rejects coordinator and participant roles even for owners", async () => {
    session(ownerId);
    for (const role of [
      ORGANIZATION_ROLES.ProjectCoordinator,
      ORGANIZATION_ROLES.Participant,
      `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.Participant}`,
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

  it.each(["invalid-role", "owner,invalid-role", "invalid-role,participant"])(
    "rejects banned invitation role %s before calling Better Auth",
    async (role) => {
      session(ownerId);
      const before = authMocks.createInvitation.mock.calls.length;
      await expect(
        client.organizations.inviteMember({ email: "target@example.org", role }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        status: 400,
        message: "Input validation failed",
        data: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              message:
                "Use a defined Organization role.",
            }),
          ]),
        },
      });
      expect(authMocks.createInvitation).toHaveBeenCalledTimes(before);
    },
  );

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
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    ).resolves.toMatchObject({ invitationId, role: ORGANIZATION_ROLES.OrganizationAdmin });
    expect(authMocks.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "new-admin@example.org",
          role: ORGANIZATION_ROLES.OrganizationAdmin,
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
        role: ORGANIZATION_ROLES.OrganizationOwner,
      }),
    ).resolves.toMatchObject({ role: ORGANIZATION_ROLES.OrganizationOwner });
  });

  it.each([
    [
      401,
      "UNAUTHORIZED",
      "SESSION_REQUIRED",
      "Your session is missing or has expired. Sign in to continue.",
    ],
    [
      403,
      "FORBIDDEN",
      "ACCESS_DENIED",
      "You do not have permission to access this resource.",
    ],
    [
      429,
      "TOO_MANY_REQUESTS",
      "RATE_LIMITED",
      "Too many requests were sent. Wait a moment and try again.",
    ],
    [
      503,
      "SERVICE_UNAVAILABLE",
      "SERVICE_UNAVAILABLE",
      "The service is temporarily unavailable. Try again later.",
    ],
    [500, "INTERNAL_SERVER_ERROR", "INTERNAL_FAILURE", "Internal server error"],
  ])(
    "preserves upstream invitation response status %s safely",
    async (status, code, reason, message) => {
      session(ownerId);
      authMocks.createInvitation.mockResolvedValueOnce(
        Response.json(
          { message: "private vendor text" },
          { status: Number(status) },
        ),
      );
      await expect(
        client.organizations.inviteMember({
          email: "target@example.org",
          role: ORGANIZATION_ROLES.OrganizationAdmin,
        }),
      ).rejects.toMatchObject({
        code,
        status: Number(status),
        message,
        data: { reason },
      });
    },
  );

  it("normalizes thrown invitation and cancellation causes instead of blaming input", async () => {
    session(ownerId);
    authMocks.createInvitation.mockRejectedValueOnce(
      new APIError("UNAUTHORIZED", {
        code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
        message: "private",
      }),
    );
    await expect(
      client.organizations.inviteMember({
        email: "target@example.org",
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      message: "Membership in the active Organization is required.",
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
    authMocks.createInvitation.mockRejectedValueOnce(new Error("private"));
    await expect(
      client.organizations.inviteMember({
        email: "target@example.org",
        role: ORGANIZATION_ROLES.OrganizationAdmin,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
    const id = randomUUID();
    await db.insert(invitation).values({
      id,
      organizationId: orgId,
      email: `${ownerId}@example.org`,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
      status: "pending",
      expiresAt: new Date(Date.now() + 3600_000),
      inviterId: ownerId,
    });
    try {
      authMocks.acceptInvitation.mockRejectedValueOnce(
        new APIError("FORBIDDEN", {
          code: "EMAIL_NOT_VERIFIED",
          message: "private",
        }),
      );
      await expect(
        client.organizations.acceptInvitation({ invitationId: id }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
        message: "Verify your email before continuing.",
        data: { reason: "EMAIL_VERIFICATION_REQUIRED" },
      });
      authMocks.cancelInvitation.mockRejectedValueOnce(new Error("private"));
      await expect(
        client.organizations.cancelInvitation({ invitationId: id }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Internal server error",
        data: { reason: "INTERNAL_FAILURE" },
      });
      expect(await invitationStatus(id)).toBe("pending");
    } finally {
      await db.delete(invitation).where(eq(invitation.id, id));
    }
  });

  it("cancels a pending invitation and rejects unknown or settled rows", async () => {
    const pendingId = randomUUID();
    const otherOrgId = `staff-other-org-${suffix}`;
    const otherInvitationId = randomUUID();
    const now = new Date();
    await db.insert(organization).values({ country: "DE",
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
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        status: "pending",
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
        inviterId: ownerId,
      },
      {
        id: otherInvitationId,
        organizationId: otherOrgId,
        email: "elsewhere@example.org",
        role: ORGANIZATION_ROLES.OrganizationAdmin,
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
