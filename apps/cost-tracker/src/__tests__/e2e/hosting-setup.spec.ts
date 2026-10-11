import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import { member, organization, projectsTable } from "@greendex/database/schema";
import { type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { expectPrivateURL, expect, test } from "./fixtures/artifact-privacy";
import { HostingJourneyFixture } from "./fixtures/hosting-journey";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// API-setup exceptions: beforeAll creates verified Users and credential accounts in
// the DB; the nested beforeAll issues A's Organization Invitation only after H
// creates the Hosting Organization in the UI. Login uses a private API request
// per browser context. Browser registration, verification, and sending staff
// invitations are excluded: the dev server has real SMTP and no mail sink.
// Mail delivery/verification remain covered by Vitest and the manual journey.
// UI GAP (01): after Create Organization, the no-access page can remain stale;
// one explicit user reload is permitted, never a weakened post-reload assertion.
// Case 04 server denial is AUTOMATED-ONLY in projects.integration.test.ts.
// Checkpoint: assignment of a different Hosting Project Coordinator has no UI.
const fixture = new HostingJourneyFixture();
let mainProjectURL: string;

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Start date").fill("2027-04-01");
  await dialog.getByLabel("End date").fill("2027-04-03");
  await dialog.getByLabel("Location").fill("Berlin");
  await dialog.getByLabel("Country").selectOption("DE");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Hosted Project", { exact: true })).toBeVisible();
  return new URL(page.url()).pathname;
}

// Disable traces for every context in this file, including auth API requests.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe.serial("Hosting Organization journey section 1", () => {
  test.beforeAll(async () => {
    await fixture.setup();
  });
  test.afterAll(async () => {
    await fixture.teardown();
  });

  test("01 H creates the Hosting Organization", async ({ browser, baseURL }) => {
    const context = await fixture.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    await page.goto("/projects");
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    const dialog = page.getByRole("dialog", { name: "Create Organization" });
    if (!(await dialog.isVisible())) {
      // The no-access screen can open the portal during pointer-down; it then
      // intercepts the final click on the button beneath it.
      await page
        .getByRole("button", { name: "Create Organization" })
        .click({ timeout: 3_000 })
        .catch(async () => {
          await expect(dialog).toBeVisible();
        });
    }
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Organization name").fill(fixture.organizationName);
    await dialog.getByLabel("Organization country").selectOption("DE");
    await dialog.getByRole("button", { name: "Create Organization" }).click();
    await expect(dialog).toBeHidden();
    // Ordinary reload after observed stale no-access screen (UI GAP).
    if (await page.getByText("No Organization access yet").isVisible())
      await page.reload();
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New project" })).toBeVisible();
    await page.goto("/organization");
    const row = page.getByRole("row").filter({ hasText: fixture.actors.H.email });
    await expect(row).toContainText(ORGANIZATION_ROLES.OrganizationOwner);
  });

  test("02 H creates Main, Existing and Isolation Hosted Projects", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    mainProjectURL = await createProject(page, fixture.projectNames[0]!);
    await createProject(page, fixture.projectNames[1]!);
    await createProject(page, fixture.projectNames[2]!);
    await page.goto("/projects");
    for (const name of fixture.projectNames)
      await expect(page.getByRole("link", { name })).toBeVisible();
  });

  test.describe("Organization Invitation acceptance", () => {
    test.beforeAll(async () => {
      await fixture.createAdminInvitation();
    });
    test("03 A accepts the admin Organization Invitation", async ({
      browser,
      baseURL,
    }) => {
      const host = await fixture.actorContext(browser, "H", baseURL!);
      const hostPage = await host.newPage();
      await hostPage.goto("/organization");
      await expect(
        hostPage.getByRole("row").filter({ hasText: fixture.actors.A.email }),
      ).toContainText(ORGANIZATION_ROLES.OrganizationAdmin);

      const admin = await fixture.actorContext(browser, "A", baseURL!);
      const page = await admin.newPage();
      await page.goto(`/accept-invitation/${fixture.invitationId}`);
      await expect(
        page.getByRole("heading", { name: "Organization Invitation" }),
      ).toBeVisible();
      await expect(page.getByText(fixture.organizationName)).toBeVisible();
      await page
        .getByRole("button", { name: "Accept Organization Invitation" })
        .click();
      // Preserve the original full-URL match; only the diagnostic receives a boolean.
      await expectPrivateURL(page, /\/projects$/);
      await page.goto("/organization");
      await expect(
        page.getByRole("row").filter({ hasText: fixture.actors.A.email }),
      ).toContainText(ORGANIZATION_ROLES.OrganizationAdmin);
      await hostPage.reload();
      await expect(
        hostPage.getByRole("row").filter({ hasText: fixture.actors.A.email }),
      ).toContainText(ORGANIZATION_ROLES.OrganizationAdmin);
    });
  });

  test("04 X sees no Hosting Project data on direct Main URL", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "X", baseURL!);
    const page = await context.newPage();
    await page.goto("/projects");
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    await page.goto(mainProjectURL);
    await expect(page.getByText("No Organization access yet")).toBeVisible();
    await expect(page.getByText(fixture.projectNames[0]!)).toHaveCount(0);
    await expect(page.getByText(fixture.organizationName)).toHaveCount(0);
    // Server authorization is separately covered by projects.integration.test.ts.
  });

  test("04a a Participant Membership can create a disposable Project despite denied assigned-list access", async ({
    browser,
    baseURL,
  }) => {
    const [hosting] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, fixture.organizationName));
    expect(hosting).toBeDefined();
    const membershipId = randomUUID();
    const projectName = `CT ${fixture.suffix} Participant disposable`;
    // Setup-only Membership: never send an Organization Invitation on real SMTP.
    await db.insert(member).values({
      id: membershipId,
      organizationId: hosting!.id,
      userId: fixture.actors.X.id,
      role: ORGANIZATION_ROLES.Participant,
      createdAt: new Date(),
    });
    try {
      const context = await fixture.actorContext(browser, "X", baseURL!);
      const page = await context.newPage();
      await page.goto("/projects");
      await expect(
        page.getByRole("button", { name: "New project" }),
      ).toBeVisible();
      const projectURL = await createProject(page, projectName);
      const [createdMembership] = await db
        .select({ role: member.role })
        .from(member)
        .where(eq(member.id, membershipId));
      expect(createdMembership?.role).toBe(
        `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      );
      await page.goto("/projects");
      await expect(page.getByRole("link", { name: projectName })).toBeVisible();
      await page.goto(projectURL);
      await expect(
        page.getByRole("heading", { name: projectName }),
      ).toBeVisible();
      await page.goto(mainProjectURL);
      await expect(
        page.getByRole("heading", { name: fixture.projectNames[0]! }),
      ).toHaveCount(0);
    } finally {
      await db
        .delete(projectsTable)
        .where(
          and(
            eq(projectsTable.organizationId, hosting!.id),
            eq(projectsTable.name, projectName),
          ),
        );
      await db.delete(member).where(eq(member.id, membershipId));
      const [remaining] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.name, projectName));
      expect(remaining).toBeUndefined();
    }
  });

  test("section-1 checkpoint: H and A retain Hosting decisions; X does not", async ({
    browser,
    baseURL,
  }) => {
    for (const actor of ["H", "A"] as const) {
      const context = await fixture.actorContext(browser, actor, baseURL!);
      const page = await context.newPage();
      await page.goto(mainProjectURL);
      await expect(
        page.getByRole("heading", { name: fixture.projectNames[0]! }),
      ).toBeVisible();
      await expect(
        page.getByText("Hosted Project", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Review submitted Claims" }),
      ).toBeVisible();
    }
  });
});
