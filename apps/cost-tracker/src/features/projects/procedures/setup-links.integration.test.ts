// @vitest-environment node
import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
  user,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq, like } from "drizzle-orm";
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
  hasPermission: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));
vi.mock("server-only", () => ({}));

import { router } from "@/lib/orpc/router";

const id = randomUUID();
const userId = `setup-user-${id}`;
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
  const now = new Date();
  await db.insert(user).values({
    id: userId,
    name: "Setup User",
    email: recipientEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { country: "DE", id: hostId, slug: hostId, name: "Host", createdAt: now },
    {
      country: "DE",
      id: partnerId,
      slug: partnerId,
      name: "Partner",
      createdAt: now,
    },
  ]);
  await db.insert(member).values([
    {
      id: `setup-member-${id}`,
      userId,
      organizationId: partnerId,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: now,
    },
    {
      id: `setup-host-member-${id}`,
      userId,
      organizationId: hostId,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: now,
    },
  ]);
  await db.insert(projectsTable).values({
    id: projectId,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: hostId,
  });
  await db.insert(hostAssignments).values({ projectId, userId });
});

beforeEach(async () => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  asUser();
  await db
    .update(member)
    .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
    .where(eq(member.organizationId, hostId));
});

afterAll(async () => {
  const created = await db
    .select({ organizationId: partnerships.organizationId })
    .from(partnerships)
    .where(eq(partnerships.projectId, projectId));
  await db.delete(links).where(eq(links.projectId, projectId));
  await db.delete(partnerships).where(eq(partnerships.projectId, projectId));
  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  await db.delete(member).where(eq(member.userId, userId));
  for (const row of created)
    if (row.organizationId !== partnerId)
      await db
        .delete(organization)
        .where(eq(organization.id, row.organizationId));
  await db.delete(organization).where(eq(organization.id, partnerId));
  await db.delete(organization).where(eq(organization.id, hostId));
  await db.delete(user).where(eq(user.id, userId));
});

describe("Partner Organization setup links", () => {
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
      await db.insert(organization).values({
        country: "DE",
        id: combinedOrgId,
        slug: combinedOrgId,
        name: `Combined ${role}`,
        createdAt: new Date(),
      });
      await db.insert(member).values({
        id: randomUUID(),
        userId,
        organizationId: combinedOrgId,
        role,
        createdAt: new Date(),
      });
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
        await db.delete(member).where(eq(member.organizationId, combinedOrgId));
        await db.delete(organization).where(eq(organization.id, combinedOrgId));
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
    const bindSuffix = randomUUID();
    const freshOrgId = `setup-bind-${bindSuffix}`;
    await db.insert(organization).values({
      country: "DE",
      id: freshOrgId,
      slug: freshOrgId,
      name: "Bind Target",
      createdAt: new Date(),
    });
    await db.insert(member).values({
      id: randomUUID(),
      userId,
      organizationId: freshOrgId,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: new Date(),
    });
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    try {
      // Files run in parallel workers against one database, so only rows
      // carrying this test's unique suffix give a stable snapshot.
      const organizationsBefore = await db
        .select({ id: organization.id })
        .from(organization)
        .where(like(organization.id, `%-${bindSuffix}`));
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
          .where(like(organization.id, `%-${bindSuffix}`)),
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
      await db.delete(member).where(eq(member.organizationId, freshOrgId));
      await db.delete(organization).where(eq(organization.id, freshOrgId));
    }
  });

  it("resolves competing redemption to one Partnership with a clear refusal", async () => {
    const raceOrgId = `setup-race-${randomUUID()}`;
    const rivalOrgId = `setup-rival-${randomUUID()}`;
    for (const organizationId of [raceOrgId, rivalOrgId]) {
      await db.insert(organization).values({
        country: "DE",
        id: organizationId,
        slug: organizationId,
        name: `Race ${organizationId}`,
        createdAt: new Date(),
      });
      await db.insert(member).values({
        id: randomUUID(),
        userId,
        organizationId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: new Date(),
      });
    }
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
        await db.delete(member).where(eq(member.organizationId, organizationId));
        await db.delete(organization).where(eq(organization.id, organizationId));
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
    await db
      .update(member)
      .set({ role })
      .where(eq(member.organizationId, hostId));
    const issue = client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    if (allowed) await expect(issue).resolves.toHaveProperty("secret");
    else await expect(issue).rejects.toThrow();
  });

  it("denies a coordinator on another hosted Project without its own assignment", async () => {
    const otherUserId = `setup-other-user-${id}`;
    const otherProjectId = `setup-other-project-${id}`;
    await db.insert(user).values({
      id: otherUserId,
      name: "Other coordinator",
      email: `${otherUserId}@example.com`,
      emailVerified: true,
    });
    await db.insert(projectsTable).values({
      id: otherProjectId,
      name: "Other Project",
      startDate: new Date(),
      endDate: new Date(),
      location: "Riga",
      country: "LV",
      organizationId: hostId,
    });
    try {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
        .where(eq(member.organizationId, hostId));
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
      await db.insert(hostAssignments).values([
        { projectId: otherProjectId, userId },
        { projectId: otherProjectId, userId: otherUserId },
      ]);
      await expect(
        client.projectPartnerships.createSetupLink({
          projectId: otherProjectId,
          recipientEmail,
        }),
      ).resolves.toHaveProperty("secret");
    } finally {
      await db.delete(projectsTable).where(eq(projectsTable.id, otherProjectId));
      await db.delete(user).where(eq(user.id, otherUserId));
    }
  });

  it("requires Owner verification and rejects expired links", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.Participant })
      .where(eq(member.organizationId, partnerId));
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ).rejects.toThrow("Owner");
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
      .where(eq(member.organizationId, partnerId));
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
