import { expect, test, type Page } from "@playwright/test";

import { HostingJourneyFixture } from "./fixtures/hosting-journey";

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
test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

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
    await expect(row).toContainText("owner");
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
      ).toContainText("admin");

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
      await expect(page).toHaveURL(/\/projects$/);
      await page.goto("/organization");
      await expect(
        page.getByRole("row").filter({ hasText: fixture.actors.A.email }),
      ).toContainText("admin");
      await hostPage.reload();
      await expect(
        hostPage.getByRole("row").filter({ hasText: fixture.actors.A.email }),
      ).toContainText("admin");
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
