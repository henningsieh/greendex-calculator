import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
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

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
]) {
  test(`email signup replaces the form with above-fold progress at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    // The browser seam isolates presentation without sending real verification mail.
    await page.route("**/api/rpc/authentication/signUp", (route) =>
      route.fulfill({ json: { json: { success: true } } }),
    );
    await page.goto("/register");
    await page.getByLabel("Name", { exact: true }).fill("Alex Morgan");
    await page.getByLabel("Email address").fill(`${"a".repeat(64)}@example.org`);
    await page.getByLabel("Password", { exact: true }).fill("example-password");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
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
        bounds.y + bounds.height <= viewport.height,
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(progress.locator("strong")).toBeVisible();
    const evidence = resolve("src/__tests__/e2e/.playwright/evidence");
    await mkdir(evidence, { recursive: true, mode: 0o700 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.classList.toggle("dark", value === "dark");
      }, theme);
      await expect(progress).toBeVisible();
      await page.screenshot({
        path: resolve(evidence, `check-inbox-${viewport.width}-${theme}.png`),
      });
    }
  });
}

test("invitation registration keeps its continuation on Google and account navigation", async ({
  page,
}) => {
  await page.goto("/register?next=%2Faccept-invitation%2Fexample-invitation");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute(
    "href",
    "/login?next=%2Faccept-invitation%2Fexample-invitation",
  );
  const [request] = await Promise.all([
    page.waitForRequest("**/api/rpc/authentication/startGoogleSignIn"),
    page.route("**/api/rpc/authentication/startGoogleSignIn", (route) =>
      route.fulfill({
        json: { json: { url: new URL("/login", page.url()).href } },
      }),
    ),
    page.getByRole("button", { name: "Continue with Google" }).click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    json: { returnTo: "/accept-invitation/example-invitation" },
  });
});

test("delivered email continues direct signup into one Organization and first-Project access", async ({
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
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Email address").fill(recipient);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
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
    const organizationInput = setup.getByLabel("Organization name");
    await organizationInput.fill(organizationName);
    await organizationInput.focus();
    await page.keyboard.press("Tab");
    await expect(setup.getByLabel("Organization country")).toBeFocused();
    await setup.getByLabel("Organization country").selectOption("DE");
    await page.keyboard.press("Tab");
    const create = setup.getByRole("button", { name: "Create Organization" });
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
