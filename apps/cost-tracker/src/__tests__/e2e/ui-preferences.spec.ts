import { createHash, randomUUID } from "node:crypto";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import { account, member, session, user } from "@greendex/database/schema";
import type { Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { expect, registerPrivateValues, test } from "./fixtures/artifact-privacy";

const id = randomUUID();
const password = randomUUID();
const email = `preferences-${id}@example.invalid`;
let ownerCookieName = "";
registerPrivateValues(password);

async function switchAccount(page: Page, address: string, secret: string) {
  await page
    .locator('header [data-testid="account-menu-trigger"]:visible')
    .click();
  await page.getByTestId("account-menu-sign-out").click();
  await page.getByTestId("confirm-dialog-execute").click();
  await page.waitForURL(/\/en-GB\/?$/);
  await page.goto("/login");
  await page.getByTestId("email").fill(address);
  await page.getByTestId("password").fill(secret);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/projects/);
}

test.describe("UI preferences", () => {
  test.beforeAll(async () => {
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, SEED_USER.email));
    if (!owner) throw new Error("Seed owner is missing");
    ownerCookieName = `project_columns_${createHash("sha256").update(owner.id).digest("hex").slice(0, 32)}`;
    const [membership] = await db
      .select()
      .from(member)
      .where(eq(member.userId, owner.id));
    if (!membership) throw new Error("Seed membership is missing");
    await db
      .insert(user)
      .values({ id, name: "Preference test user", email, emailVerified: true });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      userId: id,
      providerId: "credential",
      password: await hashPassword(password),
    });
    await db.insert(member).values({
      id: randomUUID(),
      userId: id,
      organizationId: membership.organizationId,
      role: membership.role,
      createdAt: new Date(),
    });
  });

  test.afterAll(async () => {
    await db.delete(session).where(eq(session.userId, id));
    await db.delete(member).where(eq(member.userId, id));
    await db.delete(user).where(eq(user.id, id));
  });

  test("restores separate account views, sidebar, reset and invalid preferences", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Missing base URL");
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

    await switchAccount(page, email, password);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    await page.getByTestId("project-column-toggle-startDate").uncheck();
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).not.toBeChecked();
    await switchAccount(page, SEED_USER.email, SEED_USER.password);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).not.toBeChecked();
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).toBeChecked();
    await page.getByTestId("project-columns-reset").click();
    await page.reload();
    await expect(
      page.getByTestId("project-column-toggle-location"),
    ).toBeChecked();
    await switchAccount(page, email, password);
    await page.goto("/projects");
    await expect(
      page.getByTestId("project-column-toggle-startDate"),
    ).not.toBeChecked();
    await switchAccount(page, SEED_USER.email, SEED_USER.password);
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
  });
});
