import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { db } from "@greendex/database";
import { organization, user } from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import { assertExistingIntegrationDatabase } from "../../../../../scripts/existing-integration-environment";
import { EmailInbox } from "../../../scripts/email-inbox";
import { validateMailboxEnvironment } from "../../../scripts/email-run-safety";
import { expect, registerPrivateValues, test } from "./fixtures/artifact-privacy";
import { expectFirstOrganizationProjects } from "./fixtures/first-organization";

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

for (const { viewport, fontSize } of [
  { viewport: { width: 375, height: 667 }, fontSize: 16 },
  { viewport: { width: 1280, height: 800 }, fontSize: 16 },
  { viewport: { width: 375, height: 667 }, fontSize: 24 },
]) {
  test(`email signup replaces the form with prominent progress at ${viewport.width} with ${fontSize}px text`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    // The browser seam isolates presentation without sending real verification mail.
    await page.route("**/api/rpc/authentication/signUp", (route) =>
      route.fulfill({ json: { json: { success: true } } }),
    );
    await page.goto("/register");
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);
    await page.locator("#name").fill("Alex Morgan");
    await page.locator("#email").fill(`${"a".repeat(64)}@example.org`);
    await page.locator("#password").fill("example-password");
    await page.getByTestId("auth-submit").click();
    const progress = page.getByTestId("auth-verification-message");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("role", "status");
    await expect(progress).toHaveAttribute("data-emphasis", "prominent");
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    const bounds = await progress.boundingBox();
    expect(
      bounds !== null &&
        bounds.y >= 0 &&
        (fontSize === 16
          ? bounds.y + bounds.height <= viewport.height
          : bounds.y < viewport.height),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(progress.locator("strong")).toBeVisible();
    await expect(progress.locator("p").first()).toBeInViewport();
    await progress.locator("p").last().scrollIntoViewIfNeeded();
    await expect(progress.locator("p").last()).toBeInViewport();
    const description = progress.locator('[data-slot="alert-description"]');
    expect(
      await description.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBe(fontSize);
    expect(
      await progress.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          style.backgroundColor !==
            getComputedStyle(document.body).backgroundColor &&
          style.borderLeftWidth !== "0px"
        );
      }),
    ).toBe(true);
    const evidence = resolve("src/__tests__/e2e/.playwright/evidence");
    await mkdir(evidence, { recursive: true, mode: 0o700 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
      }, theme);
      await expect(progress).toBeVisible();
      await page.screenshot({
        path: resolve(
          evidence,
          `check-inbox-${viewport.width}-${fontSize}-${theme}.png`,
        ),
      });
    }
  });
}

test("malformed invitation registration stays in recovery before and after sign-in", async ({
  page,
  context,
}) => {
  const destination = "/register?next=%2Faccept-invitation%2Fbad!";
  await page.goto(destination);
  const recovery = page.locator(
    '[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]',
  );
  await expect(recovery).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const state = JSON.parse(
    await readFile(
      process.env.GREENDEX_PLAYWRIGHT_AUTH ??
        "src/__tests__/e2e/.auth/storage-state.json",
      "utf8",
    ),
  );
  await context.addCookies(state.cookies);
  await page.goto(destination);
  await expect(recovery).toBeVisible();
  await expect(page.getByTestId("no-organization-access")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("delivered email verifies signup and verified registration continues into one Organization and first-Project access", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  validateMailboxEnvironment(environment);
  assertExistingIntegrationDatabase(environment.DATABASE_URL);
  if (!baseURL) throw new Error("Existing application URL is required.");
  const recipient = environment.EMAIL_TEST_RECIPIENT;
  const name = `Onboarding ${randomUUID()}`;
  const organizationName = `${"International ".repeat(4)}${randomUUID()}`;
  const password = `Journey-${randomUUID()}!`;
  registerPrivateValues(password, recipient);
  const existing = await db.query.user.findFirst({
    where: eq(user.email, recipient),
  });
  if (existing)
    throw new Error(
      "Dedicated workflow recipient is not clean; refusing signup.",
    );
  const inbox = new EmailInbox({
    ...environment,
    DELETE_TESTMAILS_DURING_TESTRUN: "false",
  });
  let connected = false;
  try {
    await inbox.connect();
    connected = true;
    const boundary = await inbox.boundary();
    await page.goto("/register");
    await page.locator("#name").fill(name);
    await page.locator("#email").fill(recipient);
    await page.locator("#password").fill(password);
    await page.getByTestId("auth-submit").click();
    const progress = page.getByTestId("auth-verification-message");
    await expect(progress).toBeVisible();
    await expect(progress.locator("strong")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    const link = await inbox.deliveredLink(
      boundary,
      "Verify Your Email Address",
      baseURL,
      "/api/auth/verify-email",
      (_, html) => html.includes(name),
    );
    registerPrivateValues(link);
    await page.goto(link);
    const setup = page.getByTestId("no-organization-access");
    await expect(setup).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.reload();
    await expect(setup).toBeVisible();
    await page.goto("/register");
    await expect(page).toHaveURL(new URL("/projects", baseURL).href);
    await expect(setup).toBeVisible();
    await expect(page.getByTestId("auth-verification-message")).toHaveCount(0);
    const organizationInput = setup.locator("#organization-name");
    await organizationInput.pressSequentially(organizationName);
    await expect(organizationInput).toHaveValue(organizationName);
    await page.keyboard.press("Tab");
    await expect(setup.locator("#organization-country")).toBeFocused();
    await setup.locator("#organization-country").selectOption("DE");
    const create = setup.getByTestId("create-organization");
    await expect(create).toBeEnabled();
    await page.keyboard.press("Tab");
    await expect(create).toBeFocused();
    await page.keyboard.press("Enter");
    await expectFirstOrganizationProjects(page, organizationName);
    await page.reload();
    await expectFirstOrganizationProjects(page, organizationName);
    const created = await db.query.user.findFirst({
      where: and(eq(user.email, recipient), eq(user.name, name)),
    });
    expect(created?.emailVerified).toBe(true);
    const organizations = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, organizationName));
    expect(organizations).toHaveLength(1);
  } finally {
    try {
      await db
        .delete(organization)
        .where(eq(organization.name, organizationName));
      await db
        .delete(user)
        .where(and(eq(user.email, recipient), eq(user.name, name)));
      expect(
        await db.query.user.findFirst({ where: eq(user.email, recipient) }),
      ).toBeUndefined();
      expect(
        await db.query.organization.findFirst({
          where: eq(organization.name, organizationName),
        }),
      ).toBeUndefined();
    } finally {
      if (connected) {
        const cleanup = await inbox.cleanup();
        console.log(
          `Onboarding mail cleanup retained=${cleanup.retained} deleted=${cleanup.deleted}`,
        );
      }
    }
  }
});
