// @vitest-environment node
import { db } from "@greendex/database";
import {
  claimsTable as claims,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as accounts,
  projectsTable as projects,
} from "@greendex/database/schema";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import {
  afterEach,
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

// Stable identities registered in SEED_SCENARIOS.costTrackerClaims.
const suffix = "canonical";
const host = `claim-host-${suffix}`;
const partner = `claim-partner-${suffix}`;
const coordinator = `claim-coordinator-${suffix}`;
const participant = `claim-participant-${suffix}`;
const owner = `claim-owner-${suffix}`;
const project = `claim-project-${suffix}`;
let own = `claim-own-${suffix}`;
const foreign = `claim-foreign-${suffix}`;
const account = `claim-account-${suffix}`;
const secondAccount = `claim-second-account-${suffix}`;
const foreignAccount = `claim-foreign-account-${suffix}`;
let actor = coordinator;
let activeOrg = partner;
const createdAccountIds = new Set<string>();
const client = createRouterClient(router, {
  context: async () => ({ headers: new Headers() }),
});

beforeAll(async () => {
  if (
    !(await db.query.projectsTable.findFirst({ where: eq(projects.id, project) }))
  )
    throw new Error(
      "Canonical seed required: run the isolated seeded lifecycle.",
    );
  authMocks.getSession.mockImplementation(async () => ({
    user: { id: actor },
    session: { activeOrganizationId: activeOrg },
  }));
});

beforeEach(async () => {
  own = `claim-own-${suffix}`;
  actor = coordinator;
  activeOrg = partner;
  await db.delete(claims).where(eq(claims.partnershipId, own));
  await db.delete(selections).where(eq(selections.partnershipId, own));
});

afterEach(async () => {
  await db.delete(claims).where(eq(claims.partnershipId, `claim-own-${suffix}`));
  await db
    .delete(selections)
    .where(eq(selections.partnershipId, `claim-own-${suffix}`));
  for (const id of createdAccountIds)
    await db.delete(accounts).where(eq(accounts.id, id));
  createdAccountIds.clear();
});

describe("Claim drafts and Partnership payout selection", () => {
  it("does not expose unsubmitted drafts to Hosting review", async () => {
    own = `claim-editable-${suffix}`;
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
    // reviewerAccess exercises the seeded unassigned Hosting Owner; no role
    // mutation is needed to test owner authority independently of assignment.
    actor = owner;
    expect(await client.claims.reviewerAccess({ partnershipId: own })).toEqual({
      canReview: true,
    });
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
    createdAccountIds.add(created.id);
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
      createdAccountIds.add(created.id);
      expect(created.bic).toBeNull();
      await db.delete(accounts).where(eq(accounts.id, created.id));
    }
    const omitted = await client.claims.createPayoutAccount({
      partnershipId: own,
      accountHolder: "Partner",
      iban: "DE89370400440532013000",
    });
    createdAccountIds.add(omitted.id);
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
    expect(draft.status).toBe("editable");
    own = `claim-submitted-selected-${suffix}`;
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
    own = `claim-submitted-${suffix}`;
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
    // selectPayoutAccount/saveDraft perform the mutations under test as the
    // named seeded Partner Owner, who has no coordinator assignment.
    actor = owner;
    await client.claims.selectPayoutAccount({
      partnershipId: own,
      payoutAccountId: account,
    });
    expect(await client.claims.saveDraft({ partnershipId: own })).toMatchObject({
      status: "editable",
    });
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
