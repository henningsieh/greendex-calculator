import { createHash, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  account,
  member,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import type { Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { expect, registerPrivateValues, test } from "./fixtures/artifact-privacy";

const password = randomUUID();
const archivedProjectId = randomUUID();
const users = [randomUUID(), randomUUID()].map((id) => ({
  id,
  email: `preferences-${id}@example.invalid`,
}));
const [first, second] = users;
if (!first || !second) throw new Error("Two test users are required");
const ownerCookieName = `project_columns_${createHash("sha256").update(first.id).digest("hex").slice(0, 32)}`;
let seedOwnerId = "";
let activeProjectId = "";
registerPrivateValues(password);

async function signIn(page: Page, address: string) {
  await page.goto("/login");
  await page.getByTestId("email").fill(address);
  await page.getByTestId("password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/projects/);
}

async function switchAccount(page: Page, address: string) {
  await page
    .locator('header [data-testid="account-menu-trigger"]:visible')
    .click();
  await page.getByTestId("account-menu-sign-out").click();
  await page.getByTestId("confirm-dialog-execute").click();
  await page.waitForURL(/\/en-GB\/?$/);
  await signIn(page, address);
}

test.describe("UI preferences", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, SEED_USER.email));
    if (!owner) throw new Error("Seed owner is missing");
    seedOwnerId = owner.id;
    const [membership] = await db
      .select()
      .from(member)
      .where(eq(member.userId, owner.id));
    if (!membership) throw new Error("Seed membership is missing");
    const [activeProject] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.organizationId, membership.organizationId),
          eq(projectsTable.costTrackerArchived, false),
        ),
      )
      .limit(1);
    if (!activeProject) throw new Error("An active Project is missing");
    activeProjectId = activeProject.id;
    await db.insert(projectsTable).values({
      id: archivedProjectId,
      name: `Preferences archived ${archivedProjectId}`,
      organizationId: membership.organizationId,
      startDate: new Date("2024-01-01T00:00:00.000Z"),
      endDate: new Date("2024-01-02T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      costTrackerArchived: true,
    });
    const hashedPassword = await hashPassword(password);
    for (const testUser of users) {
      await db.insert(user).values({
        ...testUser,
        name: "Preference test user",
        emailVerified: true,
      });
      await db.insert(account).values({
        id: randomUUID(),
        accountId: testUser.id,
        userId: testUser.id,
        providerId: "credential",
        password: hashedPassword,
      });
      await db.insert(member).values({
        id: randomUUID(),
        userId: testUser.id,
        organizationId: membership.organizationId,
        role: membership.role,
        createdAt: new Date(),
      });
    }
  });

  test.afterAll(async () => {
    await db.delete(projectsTable).where(eq(projectsTable.id, archivedProjectId));
    for (const testUser of users) {
      await db.delete(session).where(eq(session.userId, testUser.id));
      await db.delete(member).where(eq(member.userId, testUser.id));
      await db.delete(account).where(eq(account.userId, testUser.id));
      await db.delete(user).where(eq(user.id, testUser.id));
    }
  });

  test("restores separate account views, sidebar, reset and invalid preferences", async ({
    page,
    context,
    baseURL,
    browser,
  }) => {
    if (!baseURL) throw new Error("Missing base URL");
    await signIn(page, first.email);
    await page.goto(`/projects?scope=hosted&search=${archivedProjectId}`);
    await expect(
      page.getByTestId(`project-link-${archivedProjectId}`),
    ).toHaveCount(0);
    await page.getByTestId("project-archive-filter").click();
    await page.getByTestId("project-archive-archived").click();
    await expect(
      page.getByTestId(`project-link-${archivedProjectId}`),
    ).toBeVisible();
    await expect(page).toHaveURL(/archive=archived/);
    await page.reload();
    await expect(
      page.getByTestId(`project-link-${archivedProjectId}`),
    ).toBeVisible();
    const archivedURL = page.url();
    const directPage = await context.newPage();
    await directPage.goto(archivedURL);
    await expect(
      directPage.getByTestId(`project-link-${archivedProjectId}`),
    ).toBeVisible();
    await directPage.close();
    await page.getByTestId("project-settlement-filter").click();
    await page.getByTestId("project-settlement-ready").click();
    await expect(
      page.getByTestId(`project-link-${archivedProjectId}`),
    ).toHaveCount(0);
    await page.goto(
      `/projects?scope=hosted&archive=archived&search=${activeProjectId}`,
    );
    await expect(page.getByTestId(`project-link-${activeProjectId}`)).toHaveCount(
      0,
    );
    await context.addCookies([
      { name: "sidebar_state", value: "false", url: baseURL },
    ]);
    await page.goto("/projects?search=climate&sort=start-desc");
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    const originalURL = page.url();
    await page.getByTestId("project-column-toggle-location").uncheck();
    expect(page.url()).toBe(originalURL);
    await expect(page.getByTestId("project-column-header-location")).toHaveCount(
      0,
    );
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).not.toBeChecked();
    expect(page.url()).toBe(originalURL);
    await page.goto("/partner-organizations");
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).not.toBeChecked();
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await page.locator('[data-slot="sidebar-trigger"]').click();
    await page.reload();
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "expanded",
    );
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).not.toBeChecked();

    await switchAccount(page, second.email);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    await expect(
      page.getByTestId("project-column-header-startDate"),
    ).toBeVisible();
    await expect(page.getByTestId("project-column-header-endDate")).toBeVisible();
    await page.getByTestId("project-column-toggle-endDate").uncheck();
    await page.reload();
    await expect(page.getByTestId("project-column-header-endDate")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("project-column-toggle-endDate"),
    ).not.toBeChecked();
    await page.getByTestId("project-column-toggle-startDate").uncheck();
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).not.toBeChecked();
    await switchAccount(page, first.email);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).not.toBeChecked();
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).toBeChecked();
    await expect(page.getByTestId("project-column-toggle-endDate")).toBeChecked();
    await page.getByTestId("project-columns-reset").click();
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    await switchAccount(page, second.email);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).not.toBeChecked();
    await switchAccount(page, first.email);
    await page.goto("/projects");
    await page.getByTestId("project-column-toggle-location").uncheck();
    await context.addCookies([
      { name: ownerCookieName, value: "invalid", url: baseURL },
    ]);
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    await page.getByTestId("project-column-toggle-location").uncheck();
    await context.clearCookies({ name: ownerCookieName });
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    for (const value of [
      "x".repeat(257),
      encodeURIComponent('[2,["location"]]'),
    ]) {
      await context.addCookies([{ name: ownerCookieName, value, url: baseURL }]);
      await page.reload();
      await expect(
        page.getByTestId("project-column-toggle-location"),
      ).toBeChecked();
    }
    await context.clearCookies({ name: ownerCookieName });
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        "cookie",
      );
      Object.defineProperty(document, "cookie", {
        get: descriptor?.get,
        set() {
          throw new Error("unavailable");
        },
      });
    });
    await page.reload();
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await page.getByTestId("project-column-toggle-location").uncheck();
    await expect(page.getByTestId("project-column-header-location")).toHaveCount(
      0,
    );
    const sharedContext = await browser.newContext({
      baseURL,
      storageState:
        process.env.GREENDEX_PLAYWRIGHT_AUTH ??
        "src/__tests__/e2e/.auth/storage-state.json",
    });
    try {
      const response = await sharedContext.request.get("/api/auth/get-session");
      expect(response.ok()).toBe(true);
      expect((await response.json()).user.id).toBe(seedOwnerId);
    } finally {
      await sharedContext.close();
    }
  });
});
