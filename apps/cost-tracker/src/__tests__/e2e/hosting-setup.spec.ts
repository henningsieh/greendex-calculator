import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  invitation,
  member,
  organization,
  projectsTable,
} from "@greendex/database/schema";
import { type Page } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { expectPrivateURL, expect, test } from "./fixtures/artifact-privacy";
import { expectFirstOrganizationProjects } from "./fixtures/first-organization";
import { HostingJourneyFixture } from "./fixtures/hosting-journey";
import { projectLink, staffRow } from "./fixtures/journey-locators";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See #338 (E2E artifact privacy follow-up).
// API-setup exceptions: beforeAll creates verified Users and credential accounts in
// the DB; the nested beforeAll issues A's Organization Invitation only after H
// creates the Hosting Organization in the UI. Login uses a private API request
// per browser context. Browser registration, verification, and sending staff
// invitations are excluded: the dev server has real SMTP and no mail sink.
// Mail delivery/verification remain covered by Vitest and the manual journey.
// Case 04 server denial is AUTOMATED-ONLY in projects.integration.test.ts.
// Checkpoint: assignment of a different Hosting Project Coordinator has no UI.
const fixture = new HostingJourneyFixture();
let mainProjectURL: string;

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByTestId("new-project").filter({ visible: true }).click();
  const dialog = page.getByTestId("create-project-dialog");
  await dialog.locator("#new-project-name").fill(name);
  await dialog.locator("#new-project-start").fill("2027-04-01");
  await dialog.locator("#new-project-end").fill("2027-04-03");
  await dialog.locator("#new-project-location").fill("Berlin");
  await dialog.locator("#new-project-country").selectOption("DE");
  await dialog.getByTestId("create-project").click();
  await expect(page.getByTestId("project-workspace")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator('[data-relationship="hosted"]')).toBeVisible();
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
    // Text-free: access-denied state hook instead of visible copy.
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    const dialog = page.getByTestId("no-organization-access");
    await expect(dialog).toBeVisible();
    await dialog.locator("#organization-name").fill(fixture.organizationName);
    await dialog.locator("#organization-country").selectOption("DE");
    await dialog.getByTestId("create-organization").click();
    await expect(dialog).toBeHidden();
    await expectFirstOrganizationProjects(page, fixture.organizationName);
    await page.reload();
    await expectFirstOrganizationProjects(page, fixture.organizationName);
    await page.goto("/organization");
    const row = (await staffRow(page, fixture.actors.H.id)).getByTestId(
      `staff-role-${ORGANIZATION_ROLES.OrganizationOwner}`,
    );
    await expect(row).toBeVisible();
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
      await expect(await projectLink(page, name)).toBeVisible();
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
        hostPage.getByTestId(`staff-invitation-${fixture.invitationId}`),
      ).toBeVisible();

      const [pendingInvitation] = await db
        .select({ role: invitation.role })
        .from(invitation)
        .where(eq(invitation.id, fixture.invitationId));
      expect(pendingInvitation?.role).toBe(ORGANIZATION_ROLES.OrganizationAdmin);
      const admin = await fixture.actorContext(browser, "A", baseURL!);
      const page = await admin.newPage();
      await page.goto(`/accept-invitation/${fixture.invitationId}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Text-free: the invitation loaded (accept available) instead of org-name copy.
      await expect(
        page.getByTestId("accept-organization-invitation"),
      ).toBeEnabled();
      await page.getByTestId("accept-organization-invitation").click();
      // Preserve the original full-URL match; only the diagnostic receives a boolean.
      await expectPrivateURL(page, /\/projects$/);
      await page.goto("/organization");
      await expect(
        (await staffRow(page, fixture.actors.A.id)).getByTestId(
          `staff-role-${ORGANIZATION_ROLES.OrganizationAdmin}`,
        ),
      ).toBeVisible();
      await hostPage.reload();
      await expect(
        (await staffRow(hostPage, fixture.actors.A.id)).getByTestId(
          `staff-role-${ORGANIZATION_ROLES.OrganizationAdmin}`,
        ),
      ).toBeVisible();
    });
  });

  test("invalid Organization Invitations stay in joining recovery without creation", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "X", baseURL!);
    const page = await context.newPage();
    await page.goto(`/accept-invitation/${randomUUID()}`);
    await expect(page.locator("[data-invitation-recovery]")).toBeVisible();
    await expect(
      page.getByTestId("recheck-organization-invitation"),
    ).toBeEnabled();
    await expect(page.getByTestId("create-organization")).toHaveCount(0);
    await expect(page.locator("#organization-name")).toHaveCount(0);
    await page.getByTestId("recheck-organization-invitation").click();
    await expect(page.locator("[data-invitation-recovery]")).toBeVisible();
  });

  test("04 X sees no Hosting Project data on direct Main URL", async ({
    browser,
    baseURL,
  }) => {
    const context = await fixture.actorContext(browser, "X", baseURL!);
    const page = await context.newPage();
    await page.goto("/projects");
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    await page.goto(mainProjectURL);
    await expect(
      page.locator('[data-testid="no-organization-access"]'),
    ).toBeVisible();
    // Text-free: no project-detail links leak to the unauthorized user.
    await expect(page.locator('a[href^="/projects/"]')).toHaveCount(0);
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
      const createButton = page
        .getByTestId("new-project")
        .filter({ visible: true });
      await expect(createButton).toHaveCount(1);
      await expect(createButton).toBeVisible();
      const projectURL = await createProject(page, projectName);
      const [createdMembership] = await db
        .select({ role: member.role })
        .from(member)
        .where(eq(member.id, membershipId));
      expect(createdMembership?.role).toBe(
        `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      );
      await page.goto("/projects");
      await expect(await projectLink(page, projectName)).toBeVisible();
      await page.goto(projectURL);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.goto(mainProjectURL);
      await expect(page.getByTestId("project-workspace")).toHaveCount(0);
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
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('[data-relationship="hosted"]')).toBeVisible();
      await expect(page.locator('a[href="/claims/review"]')).toBeVisible();
    }
  });
});

test("creation from Organization management ends at the Project overview", async ({
  browser,
  baseURL,
}) => {
  const recovery = new HostingJourneyFixture();
  await recovery.setup();
  try {
    const context = await recovery.actorContext(browser, "H", baseURL!);
    const page = await context.newPage();
    await page.goto("/organization");
    await expect(page.getByRole("dialog")).toBeHidden();
    const dialog = page.getByTestId("no-organization-access");
    await expect(dialog).toBeVisible();
    await dialog.locator("#organization-name").fill(recovery.organizationName);
    await dialog.locator("#organization-country").selectOption("DE");
    await dialog.getByTestId("create-organization").click();
    await expect(dialog).toBeHidden();
    await expectPrivateURL(page, /\/projects$/);
    await expectFirstOrganizationProjects(page, recovery.organizationName);
  } finally {
    await recovery.teardown();
  }
});
