import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  hostProjectAssignmentsTable,
  claimsTable,
  member,
  organization,
  partnerOrganizationSetupLinksTable,
  projectPartnerOrganizationsTable,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { type Browser, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, eq, inArray } from "drizzle-orm";

import { expect, test, registerPrivateValues } from "./fixtures/artifact-privacy";
import { postSignInWithRateLimitRetry } from "./fixtures/rate-limit-retry";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See #338 (E2E artifact privacy follow-up).
// API-setup exceptions: beforeAll seeds verified H/E Users, credential login,
// Organization Memberships, Projects, Project Partnerships and two Claim states.
// Rejected is a fixture precondition, not evidence of a browser review decision.
// No mail-sending form is submitted; sign-in uses the auth API in a private context.
const suffix = randomUUID();
const ids = {
  hostUser: randomUUID(),
  existingUser: randomUUID(),
  host: randomUUID(),
  existing: randomUUID(),
  partnerA: randomUUID(),
  partnerB: randomUUID(),
  main: randomUUID(),
  isolation: randomUUID(),
  zero: randomUUID(),
  settled: randomUUID(),
  other: randomUUID(),
  mainA: randomUUID(),
  mainB: randomUUID(),
  isolationA: randomUUID(),
  otherB: randomUUID(),
  settledA: randomUUID(),
};
const names = {
  main: `CT ${suffix} Main`,
  isolation: `CT ${suffix} Isolation`,
  zero: `CT ${suffix} Zero Partnerships`,
  settled: `CT ${suffix} Settled`,
  other: `CT ${suffix} E Other Project`,
  partnerA: `CT ${suffix} Partner A`,
  partnerB: `CT ${suffix} Partner B`,
};
const password = randomUUID();
registerPrivateValues(password);
const hostEmail = `ct-${suffix}-h@example.invalid`;
const projectIds = [ids.main, ids.isolation, ids.zero, ids.other, ids.settled];
const partnershipIds = [
  ids.mainA,
  ids.mainB,
  ids.isolationA,
  ids.otherB,
  ids.settledA,
];
const organizationIds = [ids.host, ids.existing, ids.partnerA, ids.partnerB];
const userIds = [ids.hostUser, ids.existingUser];
const mainURL = `/projects/${ids.main}`;
const isolationURL = `/projects/${ids.isolation}`;
const zeroURL = `/projects/${ids.zero}`;

async function ownedCounts() {
  const [[users], [organizations], [projects], [partnerships], [claims]] =
    await Promise.all([
      db.select({ value: count() }).from(user).where(inArray(user.id, userIds)),
      db
        .select({ value: count() })
        .from(organization)
        .where(inArray(organization.id, organizationIds)),
      db
        .select({ value: count() })
        .from(projectsTable)
        .where(inArray(projectsTable.id, projectIds)),
      db
        .select({ value: count() })
        .from(projectPartnerOrganizationsTable)
        .where(inArray(projectPartnerOrganizationsTable.id, partnershipIds)),
      db
        .select({ value: count() })
        .from(claimsTable)
        .where(inArray(claimsTable.partnershipId, partnershipIds)),
    ]);
  return [
    users!.value,
    organizations!.value,
    projects!.value,
    partnerships!.value,
    claims!.value,
  ];
}

async function openHostedProject(page: Page, url: string) {
  await page.goto(url);
  const workspace = page.getByTestId("project-workspace");
  // The workspace is actionable only after React has taken over the streamed
  // tree; its own marker is a real hydration condition, not a timing guess.
  await expect(workspace).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Text-free: relationship state hook instead of visible copy.
  await expect(workspace).toHaveAttribute("data-relationship", "hosted");
  await expect(page.getByTestId("assigned-partner-organizations")).toBeVisible();
}

function partnerRow(page: Page, organizationId: string) {
  return page.locator(`[data-organization-id="${organizationId}"]`);
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Project readiness journey 28 and N2", () => {
  let hostContext: Awaited<ReturnType<Browser["newContext"]>> | undefined;

  test.beforeAll(async () => {
    expect(await ownedCounts()).toEqual([0, 0, 0, 0, 0]);
    const now = new Date();
    await db.insert(user).values([
      {
        id: ids.hostUser,
        name: `CT ${suffix} H`,
        email: hostEmail,
        emailVerified: true,
      },
      {
        id: ids.existingUser,
        name: `CT ${suffix} E`,
        email: `ct-${suffix}-e@example.invalid`,
        emailVerified: true,
      },
    ]);
    await db.insert(account).values({
      id: randomUUID(),
      accountId: ids.hostUser,
      userId: ids.hostUser,
      providerId: "credential",
      password: await hashPassword(password),
    });
    await db.insert(organization).values(
      organizationIds.map((id) => ({
        country: "DE" as const,
        id,
        name:
          id === ids.host
            ? `CT ${suffix} Hosting`
            : id === ids.existing
              ? `CT ${suffix} E Organization`
              : id === ids.partnerA
                ? names.partnerA
                : names.partnerB,
        slug: `ct-${id}`,
        createdAt: now,
      })),
    );
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: ids.hostUser,
        organizationId: ids.host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: ids.existingUser,
        organizationId: ids.existing,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
    ]);
    await db.insert(projectsTable).values(
      (["main", "isolation", "zero", "other", "settled"] as const).map((key) => ({
        id: ids[key],
        name: names[key],
        startDate: now,
        endDate: now,
        location: "Riga",
        country: "LV" as const,
        organizationId: key === "other" ? ids.existing : ids.host,
      })),
    );
    await db.insert(projectPartnerOrganizationsTable).values([
      { id: ids.mainA, projectId: ids.main, organizationId: ids.partnerA },
      { id: ids.mainB, projectId: ids.main, organizationId: ids.partnerB },
      {
        id: ids.isolationA,
        projectId: ids.isolation,
        organizationId: ids.partnerA,
      },
      { id: ids.otherB, projectId: ids.other, organizationId: ids.partnerB },
      { id: ids.settledA, projectId: ids.settled, organizationId: ids.partnerA },
    ]);
    // These fixture Claim states are reachable without recording any payment.
    await db.insert(claimsTable).values([
      {
        partnershipId: ids.mainA,
        status: "rejected",
        reimbursementAmountEur: "100.00",
      },
      { partnershipId: ids.otherB, status: "in_preparation" },
      {
        partnershipId: ids.settledA,
        status: "rejected",
        reimbursementAmountEur: "100.00",
      },
    ]);
    expect(await ownedCounts()).toEqual([2, 4, 5, 5, 3]);
  });

  test.afterAll(async () => {
    await hostContext?.close();
    // All descendants of owned Projects (including Claims) cascade on deletion.
    await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
    await db
      .delete(member)
      .where(inArray(member.organizationId, organizationIds));
    await db
      .delete(organization)
      .where(inArray(organization.id, organizationIds));
    await db.delete(session).where(inArray(session.userId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
    expect(await ownedCounts()).toEqual([0, 0, 0, 0, 0]);
  });

  test.beforeAll(async ({ browser, baseURL }) => {
    hostContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await postSignInWithRateLimitRetry(
      hostContext.request,
      hostEmail,
      password,
    );
    expect(response.ok(), "H setup sign-in failed").toBe(true);
  });

  test("28 shows independent terminal and claimless readiness without offering completion", async () => {
    const page = await hostContext!.newPage();
    await openHostedProject(page, mainURL);
    const assigned = page
      .getByTestId("assigned-partner-organizations")
      .getByRole("listitem");
    await expect(assigned).toHaveCount(2);
    await expect(
      partnerRow(page, ids.partnerA).locator('[data-claim-status="rejected"]'),
    ).toBeVisible();
    await expect(
      partnerRow(page, ids.partnerB).locator('[data-claim-status="none"]'),
    ).toBeVisible();
    await expect(page.getByTestId("archive-project")).toHaveCount(0);
    await expect(
      page.getByTestId("project-workspace-settlement"),
    ).toHaveAttribute("data-settlement", "open");

    // E owns another Project with the same Partner Organization B. Its editable
    // Claim must not alter Main's B readiness or appear among H's Hosted Projects.
    await page.goto("/projects");
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await expect(
      page.locator(`a[href$="${mainURL}"]`).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.locator(`a[href$="/projects/${ids.other}"]`)).toHaveCount(
      0,
    );
    await openHostedProject(page, mainURL);
    await expect(
      partnerRow(page, ids.partnerB).locator('[data-claim-status="none"]'),
    ).toBeVisible();
    // Text-free: no partner row carries the editable-claim state.
    await expect(
      page.locator('[data-claim-status="in_preparation"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId("archive-project")).toHaveCount(0);
  });

  test("archives and reopens a zero-Partnership Project after explicit confirmation", async () => {
    const page = await hostContext!.newPage();
    await openHostedProject(page, isolationURL);
    await expect(
      partnerRow(page, ids.partnerA).locator('[data-claim-status="none"]'),
    ).toBeVisible();
    await expect(page.getByTestId("archive-project")).toHaveCount(0);

    await openHostedProject(page, zeroURL);
    // Text-free: empty-state hook instead of visible copy.
    await expect(
      page.locator('[data-testid="assigned-partnerships-empty"]'),
    ).toBeVisible();
    await expect(partnerRow(page, ids.partnerA)).toHaveCount(0);
    await page.getByTestId("archive-project").click();
    await page.getByTestId("confirm-dialog-cancel").click();
    await expect(page.getByTestId("archive-project")).toBeEnabled();
    await page.getByTestId("archive-project").click();
    await page.getByTestId("confirm-dialog-execute").click();
    await expect(page.getByTestId("reopen-project")).toBeVisible();
    // The reopen button carries its own reason dialog, so the archived
    // explanation stays hidden while reopening is available.
    await expect(page.getByTestId("archive-explanation-trigger")).toHaveCount(0);
    await page.getByTestId("reopen-project").click();
    await page.locator("#reopen-reason").fill("Correct a test record");
    await page.getByRole("dialog").getByTestId("reopen-project-confirm").click();
    await expect(page.getByTestId("archive-project")).toBeVisible();
  });

  test("assigned Hosting Coordinator may archive but cannot reopen", async () => {
    await db
      .insert(hostProjectAssignmentsTable)
      .values({ projectId: ids.zero, userId: ids.hostUser });
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
      .where(eq(member.userId, ids.hostUser));
    try {
      const page = await hostContext!.newPage();
      await openHostedProject(page, zeroURL);
      await expect(page.getByTestId("archive-project")).toBeVisible();
      await page.getByTestId("archive-project").click();
      await page.getByTestId("confirm-dialog-execute").click();
      await expect(page.getByTestId("project-workspace")).toHaveAttribute(
        "data-archived",
        "true",
      );
      await expect(page.getByTestId("archive-project")).toHaveCount(0);
      await expect(page.getByTestId("reopen-project")).toHaveCount(0);
      // Without reopen permission the header shows the [i] explanation
      // instead of the button.
      const trigger = page.getByTestId("archive-explanation-trigger");
      const explanation = page.getByTestId("archive-explanation-content");
      await expect(trigger).toBeVisible();
      await trigger.hover();
      await expect(explanation).toBeVisible();
      await explanation.hover();
      const hoverStarted = Date.now();
      await expect(async () => {
        await expect(explanation).toBeVisible();
        expect(Date.now() - hoverStarted).toBeGreaterThan(120);
      }).toPass({ intervals: [50], timeout: 2000 });
      await page.keyboard.press("Escape");
      await expect(explanation).toBeHidden();
      await trigger.click();
      await expect(explanation).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(explanation).toBeHidden();
      await page.close();
    } finally {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
        .where(eq(member.userId, ids.hostUser));
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: false })
        .where(eq(projectsTable.id, ids.zero));
    }
  });

  test("opens the archived explanation with emulated touch", async ({
    browser,
    baseURL,
  }) => {
    // The [i] explanation only shows when reopening is unavailable, so run
    // as a coordinator without the reopen permission (mirrors the demotion
    // in "may archive but cannot reopen").
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.ProjectCoordinator })
      .where(eq(member.userId, ids.hostUser));
    try {
      const context = await browser.newContext({
        baseURL,
        storageState: await hostContext!.storageState(),
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await openHostedProject(page, zeroURL);
        await page.getByTestId("archive-project").click();
        await page.getByTestId("confirm-dialog-execute").click();
        await expect(page.getByTestId("reopen-project")).toHaveCount(0);
        await page.getByTestId("archive-explanation-trigger").tap();
        await expect(
          page.getByTestId("archive-explanation-content"),
        ).toBeVisible();
      } finally {
        await context.close();
      }
    } finally {
      await db
        .update(member)
        .set({ role: ORGANIZATION_ROLES.OrganizationOwner })
        .where(eq(member.userId, ids.hostUser));
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: false })
        .where(eq(projectsTable.id, ids.zero));
    }
  });

  test("partner organizations keeps archived actions disabled with keyboard and touch explanations", async ({
    browser,
    baseURL,
  }) => {
    const linkId = randomUUID();
    await db.insert(partnerOrganizationSetupLinksTable).values({
      id: linkId,
      projectId: ids.settled,
      secretHash: randomUUID(),
      recipientEmail: `ct-${suffix}-setup@example.invalid`,
      createdByUserId: ids.hostUser,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const page = await hostContext!.newPage();
    await page.goto("/partner-organizations");
    const warmResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/rpc/projectPartnerships/listSetupLinks") &&
        response.ok(),
    );
    await page.getByTestId("partner-organizations-tab-invitations").click();
    expect(JSON.stringify(await (await warmResponse).json())).toContain(
      '"costTrackerArchived":false',
    );
    const link = page.locator(`[data-setup-link-id="${linkId}"]`);
    await expect(link.locator("[data-link-status]")).toHaveAttribute(
      "data-link-status",
      "open",
    );
    await expect(link.getByTestId("close-setup-link")).toBeEnabled();
    await page.evaluate(() => Reflect.set(window, "__warmCacheNavigation", true));
    await page.getByTestId("partner-organizations-tab-partnerships").click();
    await page.getByRole("link", { name: names.settled, exact: true }).click();
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    expect(
      await page.evaluate(() => Reflect.get(window, "__warmCacheNavigation")),
    ).toBe(true);
    await page.getByTestId("archive-project").click();
    await page.getByTestId("confirm-dialog-cancel").click();
    expect(
      (
        await db
          .select({ enabled: partnerOrganizationSetupLinksTable.enabled })
          .from(partnerOrganizationSetupLinksTable)
          .where(eq(partnerOrganizationSetupLinksTable.id, linkId))
      )[0]?.enabled,
    ).toBe(true);
    await page.getByTestId("archive-project").click();
    await page.getByTestId("confirm-dialog-execute").click();
    await expect(page.getByTestId("reopen-project")).toBeVisible();
    expect(
      (
        await db
          .select({ enabled: partnerOrganizationSetupLinksTable.enabled })
          .from(partnerOrganizationSetupLinksTable)
          .where(eq(partnerOrganizationSetupLinksTable.id, linkId))
      )[0]?.enabled,
    ).toBe(false);
    await page.getByTestId("sidebar-nav-partner-organizations").click();
    expect(
      await page.evaluate(() => Reflect.get(window, "__warmCacheNavigation")),
    ).toBe(true);
    const archivedResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/rpc/projectPartnerships/listSetupLinks") &&
        response.ok(),
    );
    await page.getByTestId("partner-organizations-tab-invitations").click();
    expect(JSON.stringify(await (await archivedResponse).json())).toContain(
      '"costTrackerArchived":true',
    );
    await expect(link.locator("[data-link-status]")).toHaveAttribute(
      "data-link-status",
      "closed",
    );
    await expect(link.getByTestId("close-setup-link")).toBeDisabled();
    await expect(link.getByTestId("archive-explanation-trigger")).toBeVisible();
    await page.getByTestId("partner-organizations-tab-partnerships").click();
    const partnership = page
      .getByTestId(`partnership-row-${ids.partnerA}`)
      .filter({ has: page.getByTestId(`remove-partnership-${ids.settledA}`) });
    await expect(
      partnership.getByTestId(`remove-partnership-${ids.settledA}`),
    ).toBeDisabled();
    await expect(partnership.getByRole("link")).toBeVisible();
    await partnership.getByTestId("archive-explanation-trigger").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("archive-explanation-content")).toBeVisible();
    await page.keyboard.press("Escape");
    const touch = await browser.newContext({
      baseURL,
      storageState: await hostContext!.storageState(),
      hasTouch: true,
    });
    try {
      const touchPage = await touch.newPage();
      await touchPage.goto("/partner-organizations");
      await touchPage
        .getByTestId("partner-organizations-tab-invitations")
        .click();
      await touchPage
        .locator(`[data-setup-link-id="${linkId}"]`)
        .getByTestId("archive-explanation-trigger")
        .tap();
      await expect(
        touchPage.getByTestId("archive-explanation-content"),
      ).toBeVisible();
    } finally {
      await touch.close();
      await page.close();
      await db
        .delete(partnerOrganizationSetupLinksTable)
        .where(eq(partnerOrganizationSetupLinksTable.id, linkId));
      await db
        .update(projectsTable)
        .set({ costTrackerArchived: false })
        .where(eq(projectsTable.id, ids.settled));
    }
  });

  test("refuses a stale rejected Claim reopening after another tab archives its Project", async () => {
    const reviewPage = await hostContext!.newPage();
    await reviewPage.goto(`/partnerships/${ids.settledA}/claim/review`);
    const review = reviewPage.getByTestId("claim-review");
    await expect(review.locator('[data-claim-status="rejected"]')).toBeVisible();
    await review.getByTestId("claim-decision-reopen").click();
    const confirm = review.getByTestId("claim-decision-confirm-reopen");
    await expect(confirm).toBeEnabled();

    const archivePage = await hostContext!.newPage();
    await openHostedProject(archivePage, `/projects/${ids.settled}`);
    await archivePage.getByTestId("archive-project").click();
    await archivePage.getByTestId("confirm-dialog-execute").click();
    await expect(archivePage.getByTestId("reopen-project")).toBeVisible();

    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(review.getByRole("alert")).toBeVisible();
    await expect(review.locator('[data-claim-status="rejected"]')).toBeVisible();
    const [claim] = await db
      .select({ status: claimsTable.status })
      .from(claimsTable)
      .where(eq(claimsTable.partnershipId, ids.settledA));
    const [project] = await db
      .select({ archived: projectsTable.costTrackerArchived })
      .from(projectsTable)
      .where(eq(projectsTable.id, ids.settled));
    expect(claim?.status).toBe("rejected");
    expect(project?.archived).toBe(true);
  });
});
