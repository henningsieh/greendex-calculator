// @vitest-environment node

import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
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

/**
 * Canonical seed actors (see `SEED_SCENARIOS` in
 * `apps/calculator/scripts/seed.ts`). The permission matrix resolves the
 * seeded Hosting Organization and its named Memberships instead of
 * inserting a private Organization/User/Membership dataset. Case
 * invitations created below are removed in their own test; canonical rows
 * are never deleted. Auth stays mocked: only the database is real.
 */
const SEED_ORG_SLUG = "seed-staff-invites-org";
const SEED_OWNER_EMAIL = "owner@sieh.org";
const SEED_ADMIN_EMAIL = "seed-admin@example.org";
const SEED_COORDINATOR_EMAIL = "seed-coordinator@example.org";
const SEED_PARTICIPANT_EMAIL = "seed-participant@example.org";
const SEED_OUTSIDER_EMAIL = "seed-outsider@example.org";
const SEED_HYBRID_ADMIN_EMAIL = "seed-hybrid-admin@example.org";
const SEED_HYBRID_COORDINATOR_EMAIL = "seed-hybrid-coordinator@example.org";

let orgId = "";
let ownerId = "";
let adminId = "";
let memberId = "";
let participantId = "";
let outsiderId = "";
let hybridAdminId = "";
let hybridMemberId = "";
let baselineInvitationIds: string[] = [];
const seedInvitations = {
  causeId: "",
  pendingId: "",
  foreignId: "",
  acceptedId: "",
};

const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function session(
  userId: string,
  activeOrganizationId: string | null = orgId,
  email = `${userId}@example.org`,
) {
  authMocks.getSession.mockResolvedValue({
    session: { id: randomUUID(), userId, activeOrganizationId },
    user: { id: userId, name: userId, email },
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
    const seedOrg = await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORG_SLUG),
    });
    if (!seedOrg) throw new Error("Seed Hosting Organization is missing.");
    orgId = seedOrg.id;
    const emails = [
      SEED_OWNER_EMAIL,
      SEED_ADMIN_EMAIL,
      SEED_COORDINATOR_EMAIL,
      SEED_PARTICIPANT_EMAIL,
      SEED_OUTSIDER_EMAIL,
      SEED_HYBRID_ADMIN_EMAIL,
      SEED_HYBRID_COORDINATOR_EMAIL,
    ];
    const ids: Record<string, string> = {};
    for (const email of emails) {
      const stored = await db.query.user.findFirst({
        where: eq(user.email, email),
      });
      if (!stored) throw new Error(`Seed user is missing: ${email}`);
      ids[email] = stored.id;
    }
    ownerId = ids[SEED_OWNER_EMAIL] as string;
    adminId = ids[SEED_ADMIN_EMAIL] as string;
    memberId = ids[SEED_COORDINATOR_EMAIL] as string;
    participantId = ids[SEED_PARTICIPANT_EMAIL] as string;
    outsiderId = ids[SEED_OUTSIDER_EMAIL] as string;
    hybridAdminId = ids[SEED_HYBRID_ADMIN_EMAIL] as string;
    hybridMemberId = ids[SEED_HYBRID_COORDINATOR_EMAIL] as string;
    const partner = await db.query.organization.findFirst({
      where: eq(organization.slug, "seed-partner-org"),
    });
    if (!partner) throw new Error("Seed Partner Organization is missing.");
    for (const [key, organizationId, email, status] of [
      ["causeId", orgId, "staff-invitation-cause@example.org", "pending"],
      ["pendingId", orgId, "leaving@example.org", "pending"],
      ["foreignId", partner.id, "elsewhere@example.org", "pending"],
      ["acceptedId", orgId, "accepted@example.org", "accepted"],
    ] as const) {
      const stored = await db.query.invitation.findFirst({
        where: and(
          eq(invitation.organizationId, organizationId),
          eq(invitation.email, email),
          eq(invitation.status, status),
        ),
      });
      if (!stored) throw new Error(`Seed staff Invitation is missing: ${key}`);
      seedInvitations[key] = stored.id;
    }
    // Fail fast when the canonical role matrix drifts from the seed.
    const memberships = await db
      .select({ userId: member.userId, role: member.role })
      .from(member)
      .where(eq(member.organizationId, orgId));
    const roleByUser = new Map(
      memberships.map((entry) => [entry.userId, entry.role]),
    );
    expect(roleByUser.get(ownerId)).toBe(ORGANIZATION_ROLES.OrganizationOwner);
    expect(roleByUser.get(adminId)).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
    expect(roleByUser.get(memberId)).toBe(ORGANIZATION_ROLES.ProjectCoordinator);
    expect(roleByUser.get(participantId)).toBe(ORGANIZATION_ROLES.Participant);
    expect(roleByUser.get(hybridAdminId)).toBe(
      `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.Participant}`,
    );
    expect(roleByUser.get(hybridMemberId)).toBe(
      `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
    );
    expect(roleByUser.has(outsiderId)).toBe(false);
    baselineInvitationIds = (
      await db
        .select({ id: invitation.id })
        .from(invitation)
        .where(eq(invitation.organizationId, orgId))
    )
      .map(({ id }) => id)
      .sort();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Case invitations are removed in their own tests; canonical
    // Organizations, Memberships, and Users are never deleted. Fail loudly
    // when a case leaked a row onto the seeded Organization.
    const leftovers = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(eq(invitation.organizationId, orgId));
    expect(
      leftovers.sort((a, b) => a.id.localeCompare(b.id)),
      "case invitations changed the seed Organization baseline",
    ).toEqual(baselineInvitationIds.map((id) => ({ id })));
    expect(
      await db.query.organization.findFirst({
        where: eq(organization.slug, SEED_ORG_SLUG),
      }),
      "canonical seed Organization was deleted",
    ).not.toBeUndefined();
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
        // Canonical onboarding/invitation actors also belong to the Hosting Organization.
        ORGANIZATION_ROLES.ProjectCoordinator,
        ORGANIZATION_ROLES.OrganizationAdmin,
        `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.Participant}`,
        ORGANIZATION_ROLES.ProjectCoordinator,
        ORGANIZATION_ROLES.OrganizationOwner,
        ORGANIZATION_ROLES.Participant,
      ].sort(),
    );
    // The canonical seed owner signs in from a real mailbox domain while
    // role actors use the example domain: assert email shape, not domain.
    expect(asOwner.members[0]).toMatchObject({
      email: expect.stringContaining("@"),
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
          role: role as typeof ORGANIZATION_ROLES.OrganizationAdmin,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(authMocks.createInvitation).not.toHaveBeenCalled();
  });

  it.each([
    "invalid-role",
    `${ORGANIZATION_ROLES.OrganizationOwner},invalid-role`,
    `invalid-role,${ORGANIZATION_ROLES.Participant}`,
  ])(
    "rejects banned invitation role %s before calling Better Auth",
    async (role) => {
      session(ownerId);
      const before = authMocks.createInvitation.mock.calls.length;
      await expect(
        client.organizations.inviteMember({ email: "target@example.org", role }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Input validation failed",
        data: {
          issues: expect.arrayContaining([
            expect.objectContaining({
              message: "Use a defined Organization role.",
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
    ).resolves.toMatchObject({
      invitationId,
      role: ORGANIZATION_ROLES.OrganizationAdmin,
    });
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
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
    const id = seedInvitations.causeId;
    session(ownerId, orgId, "staff-invitation-cause@example.org");
    expect(await invitationStatus(id)).toBe("pending");
    {
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
        message: "Verify your email before continuing.",
        data: { reason: "EMAIL_VERIFICATION_REQUIRED" },
      });
      authMocks.cancelInvitation.mockRejectedValueOnce(new Error("private"));
      await expect(
        client.organizations.cancelInvitation({ invitationId: id }),
      ).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        data: { reason: "INTERNAL_FAILURE" },
      });
      expect(await invitationStatus(id)).toBe("pending");
    }
  });

  it("cancels a pending invitation and rejects unknown or settled rows", async () => {
    const pendingId = seedInvitations.pendingId;
    const otherInvitationId = seedInvitations.foreignId;
    {
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

      expect(await invitationStatus(seedInvitations.acceptedId)).toBe("accepted");
      await expect(
        client.organizations.cancelInvitation({
          invitationId: seedInvitations.acceptedId,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      await expect(
        client.organizations.cancelInvitation({
          invitationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});
