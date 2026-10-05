import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { randomUUID } from "node:crypto";

import { TRAVEL_FUNDING_RULES } from "@greendex/config/travel-funding-rules";
import { db } from "@greendex/database";
import {
  account,
  claimHistoryTable as history,
  claimsTable as claims,
  costAllocationsTable as allocations,
  member,
  organization,
  participantJourneysTable as journeys,
  partnershipPayoutAccountsTable as selections,
  payoutAccountsTable as payoutAccounts,
  projectFundingBandsTable as bands,
  projectFundingSnapshotsTable as snapshots,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  proofDocumentsTable as documents,
  session,
  travelCostEntriesTable as entries,
  travelCostEntryDocumentsTable as entryDocuments,
  user,
} from "@greendex/database/schema";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

// API-setup exceptions: verified disposable Users, memberships, Project Partnership,
// payout selection, joined Participation/Journey, frozen funding rules, synthetic
// Proof Document metadata and cost allocations are prerequisites inserted directly
// (no real storage object or bank account). The browser creates and submits the
// Claim; this spec does NOT claim browser coverage for preparing those inputs.
// No registration/invitation UI submit (real SMTP). Shared global setup's
// Project-list hydration wait is 15s (approved one-line slow-stream exception).
// Server concurrency and denied
// mutations: AUTOMATED-ONLY claims.integration.test.ts and submission.integration.test.ts.
// UI GAP: no usable active-Organization switcher; wrong-active-Organization branch
// cannot be credited as a browser PASS. No payment or Project completion performed.
const suffix = randomUUID();
const ids = {
  host: randomUUID(),
  partner: randomUUID(),
  project: randomUUID(),
  partnership: randomUUID(),
  participant: randomUUID(),
  payout: randomUUID(),
  entry: randomUUID(),
  document: randomUUID(),
};
const actors = Object.fromEntries(
  (["H", "P"] as const).map((code) => [
    code,
    {
      id: randomUUID(),
      email: `ct-${suffix}-${code.toLowerCase()}@example.invalid`,
      name: `CT ${suffix} ${code}`,
      password: randomUUID(),
    },
  ]),
) as Record<
  "H" | "P",
  { id: string; email: string; name: string; password: string }
>;
const claimURL = `/partnerships/${ids.partnership}/claim`;
const reviewURL = `/claims/review/${ids.partnership}`;
const projectName = `CT ${suffix} Main`;
const contexts: BrowserContext[] = [];
let claimId: string | undefined;
let baseline: Awaited<ReturnType<typeof counts>>;

async function counts() {
  const [
    [users],
    [organizations],
    [projectRows],
    [partnershipRows],
    [claimRows],
    [historyRows],
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(user)
      .where(inArray(user.id, [actors.H.id, actors.P.id])),
    db
      .select({ value: count() })
      .from(organization)
      .where(inArray(organization.id, [ids.host, ids.partner])),
    db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.id, ids.project)),
    db
      .select({ value: count() })
      .from(partnerships)
      .where(eq(partnerships.id, ids.partnership)),
    db
      .select({ value: count() })
      .from(claims)
      .where(eq(claims.partnershipId, ids.partnership)),
    db
      .select({ value: count() })
      .from(history)
      .where(eq(history.claimId, claimId ?? "no-claim")),
  ]);
  return [
    users!.value,
    organizations!.value,
    projectRows!.value,
    partnershipRows!.value,
    claimRows!.value,
    historyRows!.value,
  ];
}

async function pageFor(browser: Browser, actor: "H" | "P", baseURL: string) {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  contexts.push(context);
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email: actors[actor].email, password: actors[actor].password },
  });
  expect(response.ok(), `${actor} setup sign-in`).toBe(true);
  return context.newPage();
}

async function submissionState(page: Page) {
  await expect(page.getByText("Claim submitted · saved")).toBeVisible();
  await expect(
    page.getByText(/This Claim is locked for Partner editing/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Submit Claim|Save cost|Save journey|Save Claim draft/,
    }),
  ).toHaveCount(0);
  const [claim] = await db
    .select({ id: claims.id, status: claims.status })
    .from(claims)
    .where(eq(claims.partnershipId, ids.partnership));
  expect(claim).toEqual({ id: claimId, status: "submitted" });
  const events = await db
    .select({ type: history.eventType })
    .from(history)
    .where(eq(history.claimId, claimId!));
  expect(events).toEqual([{ type: "submitted" }]);
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "on" });
test.describe.serial("N5 Claim navigation and idempotence", () => {
  // Warm dev-server application work can take 30–80s per navigation.
  test.setTimeout(240_000);
  test.beforeAll(async () => {
    baseline = await counts();
    const now = new Date();
    for (const actor of Object.values(actors)) {
      await db.insert(user).values({
        id: actor.id,
        name: actor.name,
        email: actor.email,
        emailVerified: true,
      });
      await db.insert(account).values({
        id: randomUUID(),
        accountId: actor.id,
        userId: actor.id,
        providerId: "credential",
        password: await hashPassword(actor.password),
      });
    }
    await db.insert(organization).values([
      { country: "DE",
        id: ids.host,
        name: `CT ${suffix} Hosting`,
        slug: ids.host,
        createdAt: now,
      },
      { country: "DE",
        id: ids.partner,
        name: `CT ${suffix} Partner`,
        slug: ids.partner,
        createdAt: now,
      },
    ]);
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: actors.H.id,
        organizationId: ids.host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actors.P.id,
        organizationId: ids.partner,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
    ]);
    await db.insert(projects).values({
      id: ids.project,
      name: projectName,
      organizationId: ids.host,
      startDate: now,
      endDate: now,
      location: "Riga",
      country: "LV",
    });
    await db.insert(partnerships).values({
      id: ids.partnership,
      projectId: ids.project,
      organizationId: ids.partner,
    });
    await db.insert(participants).values({
      id: ids.participant,
      projectId: ids.project,
      representedOrganizationId: ids.partner,
      displayName: `CT ${suffix} Participant`,
    });
    await db.insert(snapshots).values({
      projectId: ids.project,
      rulesVersion: TRAVEL_FUNDING_RULES.version,
      participantTransportProfiles: [
        ...TRAVEL_FUNDING_RULES.participantTransportProfiles,
      ],
    });
    await db.insert(bands).values(
      TRAVEL_FUNDING_RULES.bands.map((band) => ({
        projectId: ids.project,
        minKm: String(band.minKm),
        maxKm: String(band.maxKm),
        standardEur: String(band.standardEur),
        greenEur: String(band.greenEur),
      })),
    );
    await db.insert(journeys).values({
      projectParticipantId: ids.participant,
      origin: "Berlin",
      destination: "Riga",
      tripType: "round-trip",
      erasmusDistanceKm: "850.25",
    });
    await db.insert(payoutAccounts).values({
      id: ids.payout,
      organizationId: ids.partner,
      accountHolder: `CT ${suffix} test-only reference`,
      iban: `NOT-A-BANK-ACCOUNT-${suffix}`,
    });
    await db
      .insert(selections)
      .values({ partnershipId: ids.partnership, payoutAccountId: ids.payout });
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
    if (claimId) {
      await db.delete(history).where(eq(history.claimId, claimId));
      await db.delete(claims).where(eq(claims.id, claimId));
    }
    await db
      .delete(journeys)
      .where(eq(journeys.projectParticipantId, ids.participant));
    await db.delete(participants).where(eq(participants.id, ids.participant));
    await db
      .delete(selections)
      .where(eq(selections.partnershipId, ids.partnership));
    await db.delete(payoutAccounts).where(eq(payoutAccounts.id, ids.payout));
    await db.delete(snapshots).where(eq(snapshots.projectId, ids.project));
    await db.delete(partnerships).where(eq(partnerships.id, ids.partnership));
    await db.delete(projects).where(eq(projects.id, ids.project));
    await db
      .delete(member)
      .where(inArray(member.organizationId, [ids.host, ids.partner]));
    await db
      .delete(organization)
      .where(inArray(organization.id, [ids.host, ids.partner]));
    for (const actor of Object.values(actors)) {
      await db.delete(session).where(eq(session.userId, actor.id));
      await db.delete(user).where(eq(user.id, actor.id));
    }
    expect(await counts()).toEqual(baseline);
  });

  test("N5 P opens a deep link, double-clicks Save draft, reloads and retains one Claim", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(claimURL);
    await expect(
      p.getByText(
        "No Claim has been created. Opening this workspace saves nothing.",
      ),
    ).toBeVisible();
    await expect(p.getByText(projectName)).toHaveCount(0); // deep link is the Partnership ID, not a guessed Claim ID
    const accountPicker = p.getByLabel("Payout Account", { exact: true });
    await accountPicker.selectOption(ids.payout);
    const save = p.getByRole("button", { name: "Save Claim draft" });
    await expect(save).toBeEnabled();
    await save.dblclick();
    // Inspect persisted state before any retry: never issue a blind second mutation.
    await expect(p.getByText("Claim editable · saved")).toBeVisible();
    const [saved] = await db
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.partnershipId, ids.partnership));
    expect(saved).toBeDefined();
    claimId = saved!.id;
    await expect(save).toHaveCount(0);
    await p.reload();
    await expect(p.getByText("Claim editable · saved")).toBeVisible();
    expect((await counts())[4]).toBe(1);
  });

  test("N5 P double-clicks Submit, inspects the result, then Back/Forward/reloads without editable resurrection", async ({
    browser,
    baseURL,
  }) => {
    const p = await pageFor(browser, "P", baseURL!);
    await p.goto(claimURL);
    // These rows are test-only submission prerequisites, not browser evidence for cost entry/upload.
    await db.insert(entries).values({
      id: ids.entry,
      claimId: claimId!,
      transportProfile: "train",
      amountEur: "100.00",
      allocationMethod: "equal",
    });
    await db.insert(allocations).values({
      travelCostEntryId: ids.entry,
      projectParticipantId: ids.participant,
    });
    await db.insert(documents).values({
      id: ids.document,
      claimId: claimId!,
      fileReference: `test-only/no-object/${ids.document}`,
      originalFileName: `proof-${suffix}.pdf`,
      mediaType: "application/pdf",
      byteSize: 1,
      checksum: "test-only",
    });
    await db
      .insert(entryDocuments)
      .values({ travelCostEntryId: ids.entry, proofDocumentId: ids.document });
    await p.reload();
    const checklist = p.getByRole("list", { name: "Submission checklist" });
    await expect(checklist.getByText(/^Pass:/)).toHaveCount(7);
    await p.getByRole("button", { name: "Submit Claim" }).dblclick();
    const confirm = p.getByRole("button", { name: "Confirm submission" });
    await expect(confirm).toBeVisible();
    await confirm.dblclick();
    await submissionState(p); // inspect uncertain mutation result before any retry
    await p.goto("/projects");
    await p.goBack();
    const [persisted] = await db
      .select({ status: claims.status })
      .from(claims)
      .where(eq(claims.id, claimId!));
    expect(persisted?.status).toBe("submitted");
    expect((await counts())[5]).toBe(1);
    await test.info().attach("N5-Back-state", {
      body: await p.screenshot(),
      contentType: "image/png",
    });
    await submissionState(p);
    await p.goForward();
    await p.goto(claimURL);
    await p.reload();
    await submissionState(p);
    expect((await counts())[4]).toBe(1);
  });

  test("N5 H opens review deep link; navigation and reload do not duplicate history", async ({
    browser,
    baseURL,
  }) => {
    const h = await pageFor(browser, "H", baseURL!);
    await h.goto(reviewURL);
    const review = h.getByRole("region", { name: "Claim review" });
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    await expect(
      review
        .getByRole("region", { name: "Claim history" })
        .getByText("Submitted"),
    ).toBeVisible();
    await h.goto("/claims/review");
    await expect(
      h.getByRole("link", { name: new RegExp(projectName) }),
    ).toBeVisible();
    await h.goBack();
    await h.reload();
    await expect(
      review.getByText("Submitted · awaiting Hosting review"),
    ).toBeVisible();
    expect((await counts())[5]).toBe(1);
    await expect(review.getByRole("button", { name: "Save cost" })).toHaveCount(
      0,
    );
  });
});
