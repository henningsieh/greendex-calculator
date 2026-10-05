import { randomUUID } from "node:crypto";

// @vitest-environment node
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  projectPartnerOrganizationsTable as partnerships,
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

const authMocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: authMocks } }));

import { router } from "@/lib/orpc/router";

const suffix = randomUUID();
const host = `claim-host-${suffix}`;
const partner = `claim-partner-${suffix}`;
const other = `claim-other-${suffix}`;
const coordinator = `claim-coordinator-${suffix}`;
const participant = `claim-participant-${suffix}`;
const project = `claim-project-${suffix}`;
const own = `claim-own-${suffix}`;
const foreign = `claim-foreign-${suffix}`;
const account = `claim-account-${suffix}`;
const secondAccount = `claim-second-account-${suffix}`;
const foreignAccount = `claim-foreign-account-${suffix}`;
let actor = coordinator;
let activeOrg = partner;
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values([
    {
      id: coordinator,
      name: "Coordinator",
      email: `${coordinator}@example.org`,
      emailVerified: true,
    },
    {
      id: participant,
      name: "Participant",
      email: `${participant}@example.org`,
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
    { country: "DE", id: other, name: "Other", slug: other, createdAt: now },
  ]);
  await db.insert(member).values([
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: partner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: coordinator,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participant,
      organizationId: host,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    },
    {
      id: randomUUID(),
      userId: participant,
      organizationId: partner,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: now,
    },
  ]);
  await db.insert(projects).values({
    id: project,
    name: "Project",
    startDate: now,
    endDate: now,
    location: "Riga",
    country: "LV",
    organizationId: host,
  });
  await db
    .insert(hostAssignments)
    .values({ projectId: project, userId: coordinator });
  await db.insert(partnerships).values([
    { id: own, projectId: project, organizationId: partner },
    { id: foreign, projectId: project, organizationId: other },
  ]);
  await db
    .insert(assignments)
    .values({ partnershipId: own, userId: coordinator });
  await db.insert(accounts).values([
    {
      id: account,
      organizationId: partner,
      accountHolder: "Partner",
      iban: "DE111",
    },
    {
      id: secondAccount,
      organizationId: partner,
      accountHolder: "Partner",
      iban: "DE222",
    },
    {
      id: foreignAccount,
      organizationId: other,
      accountHolder: "Other",
      iban: "DE333",
    },
  ]);
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(async () => {
  actor = coordinator;
  activeOrg = partner;
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(selections).where(eq(selections.partnershipId, own));
});

afterAll(async () => {
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(selections).where(eq(selections.partnershipId, own));
  await db.delete(accounts).where(eq(accounts.organizationId, partner));
  await db.delete(accounts).where(eq(accounts.organizationId, other));
  await db.delete(assignments).where(eq(assignments.partnershipId, own));
  await db.delete(partnerships).where(eq(partnerships.projectId, project));
  await db.delete(projects).where(eq(projects.id, project));
  await db.delete(member).where(eq(member.organizationId, partner));
  await db.delete(member).where(eq(member.organizationId, host));
  await db.delete(organization).where(eq(organization.id, other));
  await db.delete(organization).where(eq(organization.id, partner));
  await db.delete(organization).where(eq(organization.id, host));
  await db.delete(user).where(eq(user.id, participant));
  await db.delete(user).where(eq(user.id, coordinator));
});

describe("Claim drafts and Partnership payout selection", () => {
  it("does not expose unsubmitted drafts to Hosting review", async () => {
    await db.insert(claims).values({ partnershipId: own, status: "editable" });
    activeOrg = host;
    await expect(
      client.claims.getReviewDetails({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("exposes reviewer access for assigned Hosting coordinators and owners, not Partners or unassigned staff", async () => {
    expect(await client.claims.reviewerAccess({ partnershipId: own })).toEqual({
      canReview: false,
    });
    activeOrg = host;
    expect(await client.claims.reviewerAccess({ partnershipId: own })).toEqual({
      canReview: true,
    });
    actor = participant;
    await expect(
      client.claims.reviewerAccess({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
      .where(
        and(eq(member.userId, participant), eq(member.organizationId, host)),
      );
    try {
      expect(await client.claims.reviewerAccess({ partnershipId: own })).toEqual({
        canReview: true,
      });
    } finally {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
        .where(
          and(eq(member.userId, participant), eq(member.organizationId, host)),
        );
    }
  });
  it("reads only Partner payout options and the selected account without creating a Claim", async () => {
    expect(
      await client.claims.listPayoutAccounts({ partnershipId: own }),
    ).toEqual({
      accounts: expect.arrayContaining([
        expect.objectContaining({ id: account }),
        expect.objectContaining({ id: secondAccount }),
      ]),
      selectedPayoutAccountId: null,
    });
    expect(
      (await client.claims.listPayoutAccounts({ partnershipId: own })).accounts,
    ).toHaveLength(2);
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: account,
    });
    expect(
      (await client.claims.listPayoutAccounts({ partnershipId: own }))
        .selectedPayoutAccountId,
    ).toBe(account);
    expect(await client.claims.getDraft({ partnershipId: own })).toBeNull();
    await expect(
      client.claims.listPayoutAccounts({ partnershipId: foreign }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("creates a normalized Partner account without selecting it or creating a Claim", async () => {
    const created = await client.claims.createPayoutAccount({
      partnershipId: own,
      accountHolder: "  Example Partner  ",
      iban: "de89 3704 0044 0532 0130 00",
      bic: " deutdeff ",
    });
    expect(created).toMatchObject({
      accountHolder: "Example Partner",
      iban: "DE89370400440532013000",
      bic: "DEUTDEFF",
    });
    expect(
      (await client.claims.listPayoutAccounts({ partnershipId: own })).accounts,
    ).toContainEqual(created);
    expect(await client.claims.getDraft({ partnershipId: own })).toBeNull();
    expect(
      await db.select().from(selections).where(eq(selections.partnershipId, own)),
    ).toEqual([]);
    expect(
      await db.select().from(accounts).where(eq(accounts.id, created.id)),
    ).toMatchObject([{ organizationId: partner }]);
    await db.delete(accounts).where(eq(accounts.id, created.id));
  });

  it("accepts a blank optional BIC as no BIC", async () => {
    for (const bic of ["", "   "]) {
      const created = await client.claims.createPayoutAccount({
        partnershipId: own,
        accountHolder: "Partner",
        iban: "DE89370400440532013000",
        bic,
      });
      expect(created.bic).toBeNull();
      await db.delete(accounts).where(eq(accounts.id, created.id));
    }
    const omitted = await client.claims.createPayoutAccount({
      partnershipId: own,
      accountHolder: "Partner",
      iban: "DE89370400440532013000",
    });
    expect(omitted.bic).toBeNull();
    await db.delete(accounts).where(eq(accounts.id, omitted.id));
  });

  it("rejects malformed payout details without persisting an account", async () => {
    for (const input of [
      { accountHolder: "Partner", iban: "DE89370400440532013001" },
      { accountHolder: "Partner", iban: "DE89--370400440532013000" },
      { accountHolder: "   ", iban: "DE89370400440532013000" },
      { accountHolder: "P".repeat(201), iban: "DE89370400440532013000" },
      { accountHolder: "Partner", iban: "DE89370400440532013000", bic: "BAD" },
    ]) {
      await expect(
        client.claims.createPayoutAccount({ partnershipId: own, ...input }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(
      (await client.claims.listPayoutAccounts({ partnershipId: own })).accounts,
    ).toHaveLength(2);
  });

  it("restricts creation to authorized Partner staff on their Partnership", async () => {
    const input = { accountHolder: "Partner", iban: "DE89370400440532013000" };
    await expect(
      client.claims.createPayoutAccount({ partnershipId: foreign, ...input }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    activeOrg = host;
    await expect(
      client.claims.createPayoutAccount({ partnershipId: own, ...input }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    activeOrg = partner;
    actor = participant;
    await expect(
      client.claims.createPayoutAccount({ partnershipId: own, ...input }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reads an empty workspace without creating a Claim", async () => {
    expect(await client.claims.getDraft({ partnershipId: own })).toBeNull();
    expect(
      await db.select().from(claims).where(eq(claims.partnershipId, own)),
    ).toEqual([]);
  });

  it("gates first save on the selected payout account and creates once under concurrent saves", async () => {
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/payout account/i),
    });
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: account,
    });
    expect(
      await db.select().from(claims).where(eq(claims.partnershipId, own)),
    ).toEqual([]);
    const [first, second] = await Promise.all([
      client.claims.saveDraft({ partnershipId: own }),
      client.claims.saveDraft({ partnershipId: own }),
    ]);
    expect(first).toMatchObject({ partnershipId: own, status: "editable" });
    expect(second.id).toBe(first.id);
    expect(await client.claims.getDraft({ partnershipId: own })).toMatchObject({
      id: first.id,
    });
    expect(
      await db.select().from(claims).where(eq(claims.partnershipId, own)),
    ).toHaveLength(1);
  });

  it("permits reselection before and during edit, but locks submitted Claims", async () => {
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: account,
    });
    const draft = await client.claims.saveDraft({ partnershipId: own });
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: secondAccount,
    });
    expect(
      await db.select().from(selections).where(eq(selections.partnershipId, own)),
    ).toMatchObject([{ payoutAccountId: secondAccount }]);
    await db
      .update(claims)
      .set({ status: "submitted" })
      .where(eq(claims.id, draft.id));
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/locked|editable/i),
    });
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      await db.select().from(selections).where(eq(selections.partnershipId, own)),
    ).toMatchObject([{ payoutAccountId: secondAccount }]);
  });

  it("locks payout selection for an already-submitted Claim", async () => {
    await db.insert(claims).values({ partnershipId: own, status: "submitted" });
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      await db.select().from(selections).where(eq(selections.partnershipId, own)),
    ).toEqual([]);
  });

  it("rejects cross-organization accounts, other Partnerships and Hosting-side writes", async () => {
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: foreignAccount,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    for (const partnershipId of [foreign, "nonexistent"]) {
      await expect(
        client.claims.saveDraft({ partnershipId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        client.claims.selectPayoutAccount({
          partnershipId,
          payoutAccountId: account,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        client.claims.getDraft({ partnershipId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    activeOrg = host;
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows the Partner Organization owner without a coordinator assignment", async () => {
    await db.delete(assignments).where(eq(assignments.partnershipId, own));
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
      .where(eq(member.userId, coordinator));
    try {
      await client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      });
      expect(await client.claims.saveDraft({ partnershipId: own })).toMatchObject(
        { status: "editable" },
      );
    } finally {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
        .where(eq(member.userId, coordinator));
      await db
        .insert(assignments)
        .values({ partnershipId: own, userId: coordinator });
    }
  });

  it("denies Participant writes even with the active Partner Organization", async () => {
    actor = participant;
    await expect(
      client.claims.saveDraft({ partnershipId: own }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client.claims.selectPayoutAccount({
        partnershipId: own,
        payoutAccountId: account,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
