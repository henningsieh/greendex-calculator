// @vitest-environment node

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  costTrackerProjectArchiveEventsTable as archiveEvents,
  claimsTable as claims,
  claimHistoryTable as claimHistory,
  member,
  organization,
  partnerOrganizationSetupLinksTable as links,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
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

import { SEED_IDS } from "#repo/apps/calculator/scripts/seed-ids";
import {
  archiveProject,
  reopenProject,
} from "@/features/projects/procedures/archive";
import { router } from "@/lib/orpc/router";

// Stable identities registered in SEED_SCENARIOS.costTrackerSetupLinks.
const ownerId = SEED_IDS.user.setupLinksOwner;
let userId = ownerId;
const hostId = SEED_IDS.organization.setupLinksHost;
const partnerId = SEED_IDS.organization.setupLinksPartner;
let projectId: string;
let otherProjectId: string;
let ownedProjects: string[] = [];
const recipientEmail = "sg35qwjva9v00sz5lal6nq5k@example.com";
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});
const lifecycle = createRouterClient(
  { archiveProject, reopenProject },
  {
    context: async () => ({ headers: new Headers() }),
  },
);

function asUser(email = recipientEmail, activeOrganizationId = hostId) {
  authMocks.getSession.mockResolvedValue({
    session: { id: "efhnvcowbifb005qzwzfbl8k", userId, activeOrganizationId },
    user: { id: userId, email, emailVerified: true, name: "Setup User" },
  });
}

beforeAll(async () => {
  const row = await db.query.projectsTable.findFirst({
    where: eq(projectsTable.id, SEED_IDS.project.setupLinksProject),
  });
  if (!row) throw new Error("Seed required: run the isolated seeded lifecycle.");
});

beforeEach(async () => {
  vi.clearAllMocks();
  authMocks.hasPermission.mockResolvedValue({ success: true });
  userId = ownerId;
  asUser();
  ownedProjects = [];
  async function copyProject(seedId: string) {
    const [seed] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, seedId));
    if (!seed) throw new Error("Setup link Project seed required");
    const [copy] = await db
      .insert(projectsTable)
      .values({
        ...seed,
        id: crypto.randomUUID(),
        archived: false,
        costTrackerArchived: false,
        completedAt: null,
        completedByUserId: null,
      })
      .returning({ id: projectsTable.id });
    if (!copy) throw new Error("Failed to create owned Project fixture");
    ownedProjects.push(copy.id);
    const assignments = await db
      .select({ userId: hostAssignments.userId })
      .from(hostAssignments)
      .where(eq(hostAssignments.projectId, seedId));
    if (assignments.length)
      await db
        .insert(hostAssignments)
        .values(
          assignments.map(({ userId }) => ({ projectId: copy.id, userId })),
        );
    return copy.id;
  }
  projectId = await copyProject(SEED_IDS.project.setupLinksProject);
  otherProjectId = await copyProject(SEED_IDS.project.setupLinksOtherProject);
});

afterEach(async () => {
  for (const ownedProjectId of ownedProjects) {
    const ownedClaims = await db
      .select({ id: claims.id })
      .from(claims)
      .innerJoin(partnerships, eq(partnerships.id, claims.partnershipId))
      .where(eq(partnerships.projectId, ownedProjectId));
    if (ownedClaims.length)
      await db.delete(claimHistory).where(
        inArray(
          claimHistory.claimId,
          ownedClaims.map(({ id }) => id),
        ),
      );
    await db.delete(links).where(eq(links.projectId, ownedProjectId));
    await db
      .delete(partnerships)
      .where(eq(partnerships.projectId, ownedProjectId));
    await db.delete(projectsTable).where(eq(projectsTable.id, ownedProjectId));
  }
});

describe("Partner Organization setup links", () => {
  it("archives an empty Project and retains reasoned reopen history without changing Calculator archive", async () => {
    await db
      .update(projectsTable)
      .set({ archived: true })
      .where(eq(projectsTable.id, projectId));
    expect(await lifecycle.archiveProject({ projectId })).toEqual({
      projectId,
      archived: true,
    });
    await expect(
      lifecycle.reopenProject({ projectId, reason: "  " }),
    ).rejects.toThrow();
    expect(
      await lifecycle.reopenProject({ projectId, reason: " correction " }),
    ).toEqual({ projectId, archived: false });
    expect(await lifecycle.archiveProject({ projectId })).toEqual({
      projectId,
      archived: true,
    });
    expect(
      await db
        .select({ action: archiveEvents.action, reason: archiveEvents.reason })
        .from(archiveEvents)
        .where(eq(archiveEvents.projectId, projectId))
        .orderBy(archiveEvents.createdAt, archiveEvents.id),
    ).toEqual([
      { action: "archive", reason: null },
      { action: "reopen", reason: "correction" },
      { action: "archive", reason: null },
    ]);
    const [project] = await db
      .select({
        archived: projectsTable.archived,
        costTrackerArchived: projectsTable.costTrackerArchived,
      })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    expect(project).toEqual({ archived: true, costTrackerArchived: true });
  });

  it("refuses archive while a Partnership lacks a Claim", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await client.projectPartnerships.consumeSetupLink({
      ...link,
      organizationId: partnerId,
    });
    await expect(lifecycle.archiveProject({ projectId })).rejects.toMatchObject({
      data: { reason: "PROJECT_ARCHIVE_BLOCKED" },
    });
    const [project] = await db
      .select({ archived: projectsTable.costTrackerArchived })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    expect(project).toEqual({ archived: false });
  });

  it.each([
    ["editable", false],
    ["submitted", false],
    ["correction_requested", false],
    ["approved", false],
    ["paid", true],
    ["rejected", true],
  ] as const)(
    "archives only settled Claim status %s",
    async (status, settled) => {
      const link = await client.projectPartnerships.createSetupLink({
        projectId,
        recipientEmail,
      });
      const { partnershipId } = await client.projectPartnerships.consumeSetupLink(
        { id: link.id, secret: link.secret, organizationId: partnerId },
      );
      await db.insert(claims).values({ partnershipId, status });
      if (settled) {
        await expect(lifecycle.archiveProject({ projectId })).resolves.toEqual({
          projectId,
          archived: true,
        });
        await lifecycle.reopenProject({
          projectId,
          reason: "Correct administration",
        });
      } else {
        await expect(
          lifecycle.archiveProject({ projectId }),
        ).rejects.toMatchObject({ data: { reason: "PROJECT_ARCHIVE_BLOCKED" } });
      }
      const [claim] = await db
        .select({ status: claims.status })
        .from(claims)
        .where(eq(claims.partnershipId, partnershipId));
      expect(claim).toEqual({ status });
    },
  );

  it("refuses setup-link changes during archive and allows redemption after reopen", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    await lifecycle.archiveProject({ projectId });
    await expect(
      client.projectPartnerships.createSetupLink({ projectId, recipientEmail }),
    ).rejects.toThrow();
    await expect(
      client.projectPartnerships.disableSetupLink({ id: link.id }),
    ).rejects.toThrow();
    await expect(
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ).rejects.toThrow();
    await lifecycle.reopenProject({ projectId, reason: "Correct settlement" });
    const result = await client.projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    });
    expect(result.organizationId).toBe(partnerId);
  });

  it("serializes archive against setup-link redemption", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const [archive, redemption] = await Promise.allSettled([
      lifecycle.archiveProject({ projectId }),
      client.projectPartnerships.consumeSetupLink({
        id: link.id,
        secret: link.secret,
        organizationId: partnerId,
      }),
    ]);
    expect([archive.status, redemption.status].sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const [project] = await db
      .select({ archived: projectsTable.costTrackerArchived })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    const rows = await db
      .select({ id: partnerships.id })
      .from(partnerships)
      .where(eq(partnerships.projectId, projectId));
    expect({ archived: project?.archived, count: rows.length }).toEqual(
      archive.status === "fulfilled"
        ? { archived: true, count: 0 }
        : { archived: false, count: 1 },
    );
  });

  it("serializes archive against correction of a paid Claim", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const { partnershipId } = await client.projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    });
    await db
      .insert(claims)
      .values({ partnershipId, status: "paid", approvedAmountEur: "100.00" });
    const [archive, correction] = await Promise.allSettled([
      lifecycle.archiveProject({ projectId }),
      client.claims.correctPayment({
        partnershipId,
        reason: "Payment was recorded incorrectly",
      }),
    ]);
    expect([archive.status, correction.status].sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const [project] = await db
      .select({ archived: projectsTable.costTrackerArchived })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    const [claim] = await db
      .select({ status: claims.status })
      .from(claims)
      .where(eq(claims.partnershipId, partnershipId));
    expect({ archived: project?.archived, status: claim?.status }).toEqual(
      archive.status === "fulfilled"
        ? { archived: true, status: "paid" }
        : { archived: false, status: "approved" },
    );
  });

  it("keeps archived Project details readable to both authorized organizations", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const { partnershipId } = await client.projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    });
    await db.insert(claims).values({ partnershipId, status: "rejected" });
    await lifecycle.archiveProject({ projectId });
    expect(await client.projects.get({ projectId })).toMatchObject({
      relationship: "hosted",
      archived: true,
    });
    expect(await client.claims.reviewerAccess({ partnershipId })).toEqual({
      canReview: true,
      projectArchived: true,
    });
    asUser(recipientEmail, partnerId);
    expect(await client.projects.get({ projectId })).toMatchObject({
      relationship: "partner",
      archived: true,
      partnership: { id: partnershipId, claimStatus: "rejected" },
    });
    expect(
      await client.participations.listPartnership({ partnershipId }),
    ).toMatchObject({ projectArchived: true });
  });

  it("refuses participant entry and coordinator changes while archived", async () => {
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    const { partnershipId } = await client.projectPartnerships.consumeSetupLink({
      id: link.id,
      secret: link.secret,
      organizationId: partnerId,
    });
    asUser(recipientEmail, partnerId);
    const registration =
      await client.participantOnboarding.createRegistrationLink({
        partnershipId,
      });
    await db.insert(claims).values({ partnershipId, status: "rejected" });
    asUser();
    await lifecycle.archiveProject({ projectId });
    asUser(recipientEmail, partnerId);
    await expect(
      client.participantOnboarding.createRegistrationLink({ partnershipId }),
    ).rejects.toThrow();
    await expect(
      client.participantOnboarding.setRegistrationLinkOpen({
        id: registration.id,
        open: false,
      }),
    ).rejects.toThrow();
    await expect(
      client.participantOnboarding.issueInvitation({
        partnershipId,
        email: "archive-test@example.invalid",
      }),
    ).rejects.toThrow();
    await expect(
      client.projectPartnerships.assignPartnerCoordinator({
        partnershipId,
        userId: ownerId,
      }),
    ).rejects.toThrow();
  });
  it("refuses invalid, missing, inaccessible and archived Project issuance", async () => {
    for (const id of [" ", "x".repeat(129)]) {
      await expect(
        client.projectPartnerships.createSetupLink({
          projectId: id,
          recipientEmail,
        }),
      ).rejects.toThrow();
    }
    await expect(
      client.projectPartnerships.createSetupLink({
        projectId: "missing-project",
        recipientEmail,
      }),
    ).rejects.toMatchObject({ data: { reason: "PROJECT_NOT_FOUND" } });
    asUser(recipientEmail, partnerId);
    await expect(
      client.projectPartnerships.createSetupLink({ projectId, recipientEmail }),
    ).rejects.toMatchObject({ data: { reason: "PROJECT_NOT_FOUND" } });
    asUser();
    await db
      .update(projectsTable)
      .set({ costTrackerArchived: true })
      .where(eq(projectsTable.id, projectId));
    try {
      await expect(
        client.projectPartnerships.createSetupLink({ projectId, recipientEmail }),
      ).rejects.toMatchObject({ data: { reason: "PROJECT_NOT_FOUND" } });
    } finally {
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: false })
        .where(eq(projectsTable.id, projectId));
    }
  });

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
          session: {
            id: "efhnvcowbifb005qzwzfbl8k",
            userId,
            activeOrganizationId: null,
          },
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
          .set({ costTrackerArchived: true })
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
            .set({ costTrackerArchived: false })
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
    userId = SEED_IDS.user.setupLinksUser6;
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
      session: {
        id: "efhnvcowbifb005qzwzfbl8k",
        userId,
        activeOrganizationId: hostId,
      },
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
    {
      role: `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.OrganizationOwner}`,
      orgId: SEED_IDS.organization.setupLinksOrg2,
    },
    {
      role: `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.Participant}`,
      orgId: SEED_IDS.organization.setupLinksOrg3,
    },
  ])(
    "offers and consumes an existing Organization with %s membership",
    async ({ role, orgId: combinedOrgId }) => {
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
          .where(
            and(
              eq(partnerships.organizationId, combinedOrgId),
              eq(partnerships.projectId, projectId),
            ),
          );
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
    const freshOrgId = SEED_IDS.organization.setupLinksOrg4;
    const link = await client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    try {
      // Snapshot only the named seed binding target, not concurrent suites.
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
        .where(
          and(
            eq(partnerships.organizationId, freshOrgId),
            eq(partnerships.projectId, projectId),
          ),
        );
    }
  });

  it("resolves competing redemption to one Partnership with a clear refusal", async () => {
    const raceOrgId = SEED_IDS.organization.setupLinksOrg5;
    const rivalOrgId = SEED_IDS.organization.setupLinksOrg6;
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
          .where(
            and(
              eq(partnerships.organizationId, raceOrgId),
              eq(partnerships.projectId, projectId),
            ),
          ),
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
          .where(
            and(
              eq(partnerships.organizationId, organizationId),
              eq(partnerships.projectId, projectId),
            ),
          );
      }
    }
  });

  it.each([
    {
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      allowed: true,
      userId: SEED_IDS.user.setupLinksUser1,
    },
    {
      role: ORGANIZATION_ROLES.Participant,
      allowed: false,
      userId: SEED_IDS.user.setupLinksUser2,
    },
    {
      role: ORGANIZATION_ROLES.Participant,
      allowed: false,
      userId: SEED_IDS.user.setupLinksUser2,
    },
    {
      role: ORGANIZATION_ROLES.OrganizationAdmin,
      allowed: true,
      userId: SEED_IDS.user.setupLinksUser3,
    },
    {
      role: ORGANIZATION_ROLES.OrganizationOwner,
      allowed: true,
      userId: SEED_IDS.user.setupLinksUser4,
    },
  ])("scopes setup-link issuance for $role", async (testCase) => {
    userId = testCase.userId;
    const { allowed } = testCase;
    asUser();
    const issue = client.projectPartnerships.createSetupLink({
      projectId,
      recipientEmail,
    });
    if (allowed) await expect(issue).resolves.toHaveProperty("secret");
    else await expect(issue).rejects.toThrow();
  });

  it("denies a coordinator on another hosted Project without its own assignment", async () => {
    userId = SEED_IDS.user.setupLinksUser1;
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
    userId = SEED_IDS.user.setupLinksUser5;
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
    userId = SEED_IDS.user.setupLinksUser6;
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
