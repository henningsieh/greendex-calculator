import { mkdirSync } from "fs";
import { dirname } from "node:path";

import { SEED_USER } from "@greendex/auth/seed-user";
import en from "@greendex/i18n/locales/en.json" with { type: "json" };
import { chromium, expect, type FullConfig } from "@playwright/test";

/**
 * Global setup for Playwright tests
 * This runs once before all tests and verifies the app + DB by performing a login
 *
 * Environment variables are loaded by `dotenv run` before Playwright starts.
 * Don't import from @/env here to avoid validation errors during type-checking.
 */
async function globalSetup(config: FullConfig) {
  // Use the configured existing server. This does not establish production provenance.
  // Launch browser for setup checks
  const browser = await chromium.launch({
    headless: process.env.HEADED !== "true",
  });
  const page = await browser.newPage();

  const storagePath =
    process.env.GREENDEX_PLAYWRIGHT_AUTH ??
    "src/__tests__/e2e/.auth/storageState.json";

  try {
    const baseURL =
      config.projects[0].use.baseURL || process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseURL) {
      throw new Error(
        "Base URL is not defined. Please set NEXT_PUBLIC_BASE_URL environment variable.",
      );
    }

    // Navigate to sign in page
    const loginUrl = new URL("/en/login", baseURL).toString();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Build safe regexes from translations
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
    const titleRegex = new RegExp(escapeRegExp(en.authentication.login.title));

    // Wait for expected text on sign-in page
    await page
      .getByRole("heading", { level: 1, name: titleRegex })
      .waitFor({ timeout: 30_000 });
    // Text-free: heading above + form inputs below prove full page render (no copy).

    console.log("✅ Sign-in page loaded with expected content");

    // Wait for the login form inputs to be rendered (client-side)
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });

    // Login with seed user
    await page.fill('input[name="email"]', SEED_USER.email);
    await page.fill('input[name="password"]', SEED_USER.password);

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for redirect to dashboard
    await page.waitForURL("**/org/dashboard", { timeout: 30_000 });

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard", exact: true }),
    ).toBeVisible();

    // Ensure auth dir exists and save storage state for the rest of the suite
    mkdirSync(dirname(storagePath), { recursive: true, mode: 0o700 });
    await page.context().storageState({ path: storagePath });
    console.log(`✅ Auth storage saved to ${storagePath}`);
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
