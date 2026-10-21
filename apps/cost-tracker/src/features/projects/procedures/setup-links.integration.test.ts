// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerSetupLinks.
const id = "canonical";
const ownerId = `setup-user-${id}`;
let userId = ownerId;
const hostId = `setup-host-${id}`;
const partnerId = `setup-partner-${id}`;
const projectId = `setup-project-${id}`;
const recipientEmail = `setup-${id}@example.com`;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

function asUser(email = recipientEmail, activeOrganizationId = hostId) {
  authMocks.getSession.mockResolvedValue({
    session: { id, userId, activeOrganizationId },
    user: { id: userId, email, emailVerified: true, name: "Setup User" },
  });
}

beforeAll(async () => {
  const row = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, projectId),
  });
  if (!row)
    throw new Error(
      "Canonical seed required: run the isolated seeded lifecycle.",
    );
});

beforeEach(async () => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  userId = ownerId;
  asUser();
});

afterEach(async () => {
  // Setup Links and Partnerships are procedure outputs; never delete canonical identities.
  for (const ownedProjectId of [projectId, `setup-other-project-${id}`]) {
    await db.delete(links).where(eq(links.projectId, ownedProjectId));
    await db
      .delete(partnerships)
      .where(eq(partnerships.projectId, ownedProjectId));
  }
});

describe("Partner Organization setup links", () => {
  it("prevalidates without active Organization context and recovers the exact redeemed Organization", async () => {
    const hostingMembershipsBefore = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.organizationId, hostId))
      .orderBy(member.id);
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    asUser(recipientEmail, "");
    const input = { id: link.id, secret: link.secret };
    expect(
      await client.projectPartnerships.getSetupLinkEligibility(input),
    ).toEqual({
      status: "eligible",
      projectId,
    });
    const result = await client.projectPartnerships.consumeSetupLink({
      ...input,
      organizationId: partnerId,
    });
    expect(
      await client.projectPartnerships.getSetupLinkEligibility(input),
    ).toEqual({
      status: "redeemed",
      projectId,
      ...result,
    });
    expect(
      await client.projectPartnerships.consumeSetupLink({
        ...input,
        organizationId: partnerId,
      }),
    ).toEqual(result);
    const hostingMemberships = await db
      .select({ id: member.id })
      .from(member)
      .where(eq(member.organizationId, hostId))
      .orderBy(member.id);
    expect(hostingMemberships).toEqual(hostingMembershipsBefore);
  });

  it.each([
    ["secret", "SETUP_LINK_NOT_FOUND"],
    ["missing", "SETUP_LINK_NOT_FOUND"],
    ["recipient", "SETUP_LINK_WRONG_EMAIL"],
    ["verification", "EMAIL_VERIFICATION_REQUIRED"],
    ["disabled", "SETUP_LINK_DISABLED"],
    ["expired", "SETUP_LINK_EXPIRED"],
    ["archived", "PROJECT_NOT_FOUND"],
    ["anonymous", "SESSION_REQUIRED"],
  ])(
    "refuses %s before creation and independently at redemption",
    async (invalid, reason) => {
      const link = await client.projectPartnerships.createSetupLink({
        projectId,
        recipientEmail,
      });
      const input = {
        id: invalid === "missing" ? "missing-link" : link.id,
        secret: invalid === "secret" ? "wrong" : link.secret,
      };
      if (invalid === "recipient") asUser("wrong@example.com");
      if (invalid === "verification") {
        authMocks.getSession.mockResolvedValue({
          session: { id, userId, activeOrganizationId: null },
          user: { id: userId, email: recipientEmail, emailVerified: false },
        });
      }
      if (invalid === "anonymous") authMocks.getSession.mockResolvedValue(null);
      if (invalid === "disabled")
        await db
          .update(links)
          .set({ enabled: false })
          .where(eq(links.id, link.id));
      if (invalid === "expired")
        await db
          .update(links)
          .set({ expiresAt: new Date(0) })
          .where(eq(links.id, link.id));
      if (invalid === "archived")
        await db
          .update(projectsTable)
          .set({ archived: true })
          .where(eq(projectsTable.id, projectId));
      const organizationsBefore = await db
        .select({ id: organization.id })
        .from(organization)
        .orderBy(organization.id);
      try {
        await expect(
          client.projectPartnerships.getSetupLinkEligibility(input),
        ).rejects.toMatchObject({ data: { reason } });
        await expect(
          client.projectPartnerships.consumeSetupLink({
            ...input,
            organizationId: partnerId,
          }),
        ).rejects.toMatchObject({ data: { reason } });
        expect(
          await db
            .select({ id: organization.id })
            .from(organization)
            .orderBy(organization.id),
        ).toEqual(organizationsBefore);
        expect(
          await db
            .select({ partnershipId: links.partnershipId })
            .from(links)
            .where(eq(links.id, link.id)),
        ).toEqual([{ partnershipId: null }]);
      } finally {
        if (invalid === "archived")
          await db
            .update(projectsTable)
            .set({ archived: false })
            .where(eq(projectsTable.id, projectId));
      }
    },
  );

  it("revalidates after precheck without destroying the independently owned Organization", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = { id: link.id, secret: link.secret };
    expect(
      await client.projectPartnerships.getSetupLinkEligibility(input),
    ).toEqual({ status: "eligible", projectId });
    await client.projectPartnerships.disableSetupLink({ id: link.id });
    await expect(
      client.projectPartnerships.consumeSetupLink({
        ...input,
        organizationId: partnerId,
      }),
    ).rejects.toMatchObject({ data: { reason: "SETUP_LINK_DISABLED" } });
    expect(
      await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, partnerId)),
    ).toEqual([{ id: partnerId }]);
  });

  it("does not disclose redeemed Organization recovery to another recipient identity", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = { id: link.id, secret: link.secret };
    const result = await client.projectPartnerships.consumeSetupLink({
      ...input,
      organizationId: partnerId,
    });
    userId = `setup-partner-participant-${id}`;
    asUser();
    await expect(
      client.projectPartnerships.getSetupLinkEligibility(input),
    ).rejects.toMatchObject({ data: { reason: "SETUP_LINK_USED" } });
    userId = ownerId;
    asUser();
    expect(
      await client.projectPartnerships.getSetupLinkEligibility(input),
    ).toEqual({ status: "redeemed", projectId, ...result });
  });

  it("requires current Ownership for both recovery and replay, not administrative authority", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = { id: link.id, secret: link.secret, organizationId: partnerId };
    const result = await client.projectPartnerships.consumeSetupLink(input);
    const ownership = and(
      eq(member.userId, ownerId),
      eq(member.organizationId, partnerId),
    );
    try {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.OrganizationAdmin })
        .where(ownership);
      await expect(
        client.projectPartnerships.getSetupLinkEligibility(input),
      ).rejects.toMatchObject({
        data: { reason: "ORGANIZATION_OWNER_REQUIRED" },
      });
      await expect(
        client.projectPartnerships.consumeSetupLink(input),
      ).rejects.toMatchObject({
        data: { reason: "ORGANIZATION_OWNER_REQUIRED" },
      });
    } finally {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
        .where(ownership);
    }
    expect(await client.projectPartnerships.consumeSetupLink(input)).toEqual(
      result,
    );
  });

  it("creates a Partnership for an Owner exactly once on replay", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = {
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    };
    const first = await client.projectPartnerships.consumeSetupLink(input);
    expect(await client.projectPartnerships.consumeSetupLink(input)).toEqual(
      first,
    );
    expect(
      (
        await db
          .select()
          .from(partnerships)
          .where(eq(partnerships.projectId, projectId))
      ).length,
    ).toBe(1);
    const duplicate = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await expect(
      client.projectPartnerships.consumeSetupLink({
        ...input,
        id: duplicate.id,
        secret: duplicate.secret,
      }),
    ).rejects.toThrow("already assigned");
  });

  it("separates an unverified recipient from a wrong recipient without consuming the link", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    authMocks.getSession.mockResolvedValue({
      session: { id, userId, activeOrganizationId: hostId },
      user: {
        id: userId,
        email: recipientEmail,
        emailVerified: false,
        name: "Setup User",
      },
    });
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Verify your email before continuing.",
      data: { reason: "EMAIL_VERIFICATION_REQUIRED" },
    });
    const [unchanged] = await db
      .select({ partnershipId: links.partnershipId })
      .from(links)
      .where(eq(links.id, link.id));
    expect(unchanged?.partnershipId).toBeNull();
  });

  it.each([
    `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.OrganizationOwner}`,
    `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.Participant}`,
  ])(
    "offers and consumes an existing Organization with %s membership",
    async (role) => {
      const combinedOrgId = `setup-combined-${role}-${id}`;
      let linkId: string | undefined;
      try {
        const link = await client.projectPartnerships.createSetupLink({
          projectId,
          recipientEmail,
        });
        linkId = link.id;
        const matches = await client.organizations.listMine({
          search: combinedOrgId,
        });
        expect(matches).toEqual([
          { id: combinedOrgId, name: `Combined ${role}` },
        ]);
        const result = await client.projectPartnerships.consumeSetupLink({
          id: link.id,
          secret: link.secret,
          organizationId: matches[0]!.id,
        });
        expect(result.organizationId).toBe(combinedOrgId);
        expect(
          await db
            .select()
            .from(partnerships)
            .where(eq(partnerships.id, result.partnershipId)),
        ).toHaveLength(1);
      } finally {
        if (linkId) await db.delete(links).where(eq(links.id, linkId));
        await db
          .delete(partnerships)
          .where(eq(partnerships.organizationId, combinedOrgId));
      }
    },
  );

  it("rejects wrong email and disabled links without creating a Partnership", async () => {
    const before = await db
      .select({ id: partnerships.id })
      .from(partnerships)
      .where(eq(partnerships.projectId, projectId));
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const input = {
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    };
    asUser("wrong@example.com");
    await expect(
      client.projectPartnerships.consumeSetupLink(input),
    ).rejects.toThrow("another email");
    asUser();
    await client.projectPartnerships.disableSetupLink({ id: link.id });
    await expect(
      client.projectPartnerships.consumeSetupLink(input),
    ).rejects.toThrow("disabled");
    expect(
      await db
        .select({ id: partnerships.id })
        .from(partnerships)
        .where(eq(partnerships.projectId, projectId)),
    ).toEqual(before);
  });

  it("binds an eligible Organization without writing Organization or Membership rows", async () => {
    // Redemption only binds: the Organization (and creator Ownership) is
    // created beforehand through the supported Better Auth flow (ADR-0013),
    // so consuming the link must not add Organization or Membership rows.
    const freshOrgId = `setup-bind-${id}`;
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    try {
      // Snapshot only the named canonical binding target, not concurrent suites.
      const organizationsBefore = await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, freshOrgId));
      const membershipsBefore = await db
        .select({ id: member.id })
        .from(member)
        .where(eq(member.organizationId, freshOrgId));
      const result = await client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: freshOrgId,
      });
      expect(result.organizationId).toBe(freshOrgId);
      expect(
        await db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.id, freshOrgId)),
      ).toEqual(organizationsBefore);
      expect(
        await db
          .select({ id: member.id })
          .from(member)
          .where(eq(member.organizationId, freshOrgId)),
      ).toEqual(membershipsBefore);
    } finally {
      await db.delete(links).where(eq(links.id, link.id));
      await db
        .delete(partnerships)
        .where(eq(partnerships.organizationId, freshOrgId));
    }
  });

  it("resolves competing redemption to one Partnership with a clear refusal", async () => {
    const raceOrgId = `setup-race-${id}`;
    const rivalOrgId = `setup-rival-${id}`;
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    try {
      const attempt = () =>
        client.projectPartnerships.consumeSetupLink({
          id: link.id,
          secret: link.secret,
          organizationId: raceOrgId,
        });
      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () => attempt()),
      );
      for (const outcome of outcomes) expect(outcome).toEqual(outcomes[0]);
      expect(
        await db
          .select({ id: partnerships.id })
          .from(partnerships)
          .where(eq(partnerships.organizationId, raceOrgId)),
      ).toHaveLength(1);
      await expect(
        client.projectPartnerships.consumeSetupLink({
          id: link.id,
          secret: link.secret,
          organizationId: rivalOrgId,
        }),
      ).rejects.toThrow("already been used");
    } finally {
      await db.delete(links).where(eq(links.id, link.id));
      for (const organizationId of [raceOrgId, rivalOrgId]) {
        await db
          .delete(partnerships)
          .where(eq(partnerships.organizationId, organizationId));
      }
    }
  });

  it.each([
    { role: ORGANIZATION_ROLES.ProjectCoordinator, allowed: true },
    { role: ORGANIZATION_ROLES.Participant, allowed: false },
    { role: ORGANIZATION_ROLES.Participant, allowed: false },
    { role: ORGANIZATION_ROLES.OrganizationAdmin, allowed: true },
    { role: ORGANIZATION_ROLES.OrganizationOwner, allowed: true },
  ])("scopes setup-link issuance for $role", async ({ role, allowed }) => {
    userId = `setup-host-${role}-${id}`;
    asUser();
    const issue = client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    if (allowed) await expect(issue).resolves.toHaveProperty("secret");
    else await expect(issue).rejects.toThrow();
  });

  it("denies a coordinator on another hosted Project without its own assignment", async () => {
    const otherProjectId = `setup-other-project-${id}`;
    userId = `setup-host-coordinator-${id}`;
    asUser();
    await expect(
      client.projectPartnerships.createSetupLink({
        projectId: otherProjectId,
        recipientEmail,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "You need Hosting Organization staff access or an assignment to this Project.",
      data: { reason: "HOST_COORDINATION_REQUIRED" },
    });
    await expect(
      client.projectPartnerships.createSetupLink({ projectId, recipientEmail }),
    ).resolves.toHaveProperty("secret");
    userId = `setup-assigned-coordinator-${id}`;
    asUser();
    await expect(
      client.projectPartnerships.createSetupLink({
        projectId: otherProjectId,
        recipientEmail,
      }),
    ).resolves.toHaveProperty("secret");
  });

  it("requires Owner verification and rejects expired links", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    userId = `setup-partner-participant-${id}`;
    asUser();
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ).rejects.toThrow("Owner");
    userId = ownerId;
    asUser();
    // Deliberately expire this procedure-produced Link to exercise its expiry guard.
    await db
      .update(links)
      .set({ expiresAt: new Date(0) })
      .where(eq(links.id, link.id));
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ).rejects.toThrow("expired");
  });
});
