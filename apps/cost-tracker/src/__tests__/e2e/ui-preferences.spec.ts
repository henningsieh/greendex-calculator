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
import { eq } from "drizzle-orm";

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
const activeProjectId = randomUUID();
const activeProjectName = `Preferences active ${activeProjectId}`;
registerPrivateValues(password);

async function signIn(page: Page, address: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("email").fill(address);
  await page.getByTestId("password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/projects/);
  await expect(page.getByTestId("project-list")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
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

async function expectColumnVisibility(
  page: Page,
  column: string,
  visible: boolean,
) {
  await expect(page.getByTestId("project-list")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.getByTestId("project-columns-menu").click();
  await expect(
    page.getByTestId(`project-column-toggle-${column}`),
  ).toHaveAttribute("aria-checked", String(visible));
  await page.keyboard.press("Escape");
}

async function hideColumn(page: Page, column: string) {
  await expect(page.getByTestId("project-list")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.getByTestId("project-columns-menu").click();
  await page.getByTestId(`project-column-toggle-${column}`).click();
  await page.keyboard.press("Escape");
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
    await db.insert(projectsTable).values({
      id: activeProjectId,
      name: activeProjectName,
      organizationId: membership.organizationId,
      startDate: new Date("2024-01-01T00:00:00.000Z"),
      endDate: new Date("2024-01-02T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      costTrackerArchived: false,
    });
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
    await db.delete(projectsTable).where(eq(projectsTable.id, activeProjectId));
    for (const testUser of users) {
      await db.delete(session).where(eq(session.userId, testUser.id));
      await db.delete(member).where(eq(member.userId, testUser.id));
      await db.delete(account).where(eq(account.userId, testUser.id));
      await db.delete(user).where(eq(user.id, testUser.id));
    }
  });

  test("restores archive filters through reloads and direct links", async ({
    page,
    context,
    baseURL,
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
      `/projects?scope=hosted&search=${encodeURIComponent(activeProjectName)}`,
    );
    await expect(
      page.getByTestId(`project-link-${activeProjectId}`),
    ).toBeVisible();
    await page.goto(
      `/projects?scope=hosted&archive=archived&search=${encodeURIComponent(activeProjectName)}`,
    );
    await expect(page.getByTestId(`project-link-${activeProjectId}`)).toHaveCount(
      0,
    );
  });

  test("restores separate account columns, Sidebar and column reset", async ({
    page,
    context,
    baseURL,
  }) => {
    // Several account changes and reloads exercise real browser persistence.
    test.setTimeout(180_000);
    if (!baseURL) throw new Error("Missing base URL");
    await signIn(page, first.email);
    await context.addCookies([
      { name: "sidebar_state", value: "false", url: baseURL },
    ]);
    await page.goto(
      `/projects?search=climate&sort=${encodeURIComponent(
        JSON.stringify([
          { field: "startDate", direction: "desc" },
          { field: "endDate", direction: "desc" },
        ]),
      )}`,
    );
    await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expectColumnVisibility(page, "location", true);
    const originalURL = page.url();
    await hideColumn(page, "location");
    expect(page.url()).toBe(originalURL);
    await expect(page.getByTestId("project-column-header-location")).toHaveCount(
      0,
    );
    await page.reload();
    await expectColumnVisibility(page, "location", false);
    expect(page.url()).toBe(originalURL);
    await page.goto("/partner-organizations");
    await page.goto("/projects");
    await expectColumnVisibility(page, "location", false);
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
    await expectColumnVisibility(page, "location", false);

    await switchAccount(page, second.email);
    await page.goto("/projects");
    await expectColumnVisibility(page, "location", true);
    await expect(
      page.getByTestId("project-column-header-startDate"),
    ).toBeVisible();
    await expect(page.getByTestId("project-column-header-endDate")).toBeVisible();
    await hideColumn(page, "endDate");
    await page.reload();
    await expect(page.getByTestId("project-column-header-endDate")).toHaveCount(
      0,
    );
    await expectColumnVisibility(page, "endDate", false);
    await hideColumn(page, "startDate");
    await page.reload();
    await expectColumnVisibility(page, "startDate", false);
    await switchAccount(page, first.email);
    await page.goto("/projects");
    await expectColumnVisibility(page, "location", false);
    await expectColumnVisibility(page, "startDate", true);
    await expectColumnVisibility(page, "endDate", true);
    await page.getByTestId("project-columns-menu").click();
    await page.getByTestId("project-columns-reset").click();
    await page.reload();
    await expectColumnVisibility(page, "location", true);
    await switchAccount(page, second.email);
    await page.goto("/projects");
    await expectColumnVisibility(page, "startDate", false);
  });

  test("recovers missing, malformed and unavailable preference storage", async ({
    page,
    context,
    baseURL,
    browser,
  }) => {
    test.setTimeout(120_000);
    if (!baseURL) throw new Error("Missing base URL");
    await signIn(page, first.email);
    await page.goto("/projects");
    await hideColumn(page, "location");
    await context.addCookies([
      { name: ownerCookieName, value: "invalid", url: baseURL },
    ]);
    await page.reload();
    await expectColumnVisibility(page, "location", true);
    await hideColumn(page, "location");
    await context.clearCookies({ name: ownerCookieName });
    await page.reload();
    await expectColumnVisibility(page, "location", true);
    for (const value of [
      "x".repeat(257),
      encodeURIComponent('[2,["location"]]'),
    ]) {
      await context.addCookies([{ name: ownerCookieName, value, url: baseURL }]);
      await page.reload();
      await expectColumnVisibility(page, "location", true);
    }
    await context.clearCookies({ name: ownerCookieName });
    await page.addInitScript(() => {
      const descriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        "cookie",
      );
      Object.defineProperty(document, "cookie", {
        // Call the original getter with the document as `this`; a bare
        // method reference would lose its receiver.
        get: () => descriptor?.get?.call(document),
        set() {
          throw new Error("unavailable");
        },
      });
    });
    await page.reload();
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await hideColumn(page, "location");
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
