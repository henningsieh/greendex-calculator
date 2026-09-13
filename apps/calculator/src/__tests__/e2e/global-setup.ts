import { mkdirSync } from "fs";

import en from "@greendex/i18n/locales/en.json" with { type: "json" };
import { chromium, type FullConfig } from "@playwright/test";

import { SEED_USER } from "../../../scripts/seed-user";

/**
 * Global setup for Playwright tests
 * This runs once before all tests and verifies the app + DB by performing a login
 *
 * Environment variables are loaded by dotenv-cli before Playwright starts.
 * Don't import from @/env here to avoid validation errors during type-checking.
 */
async function globalSetup(config: FullConfig) {
  // Launch browser for setup checks
  const browser = await chromium.launch({
    headless: process.env.HEADED !== "true",
  });
  const page = await browser.newPage();

  const storagePath = "src/__tests__/e2e/.auth/storageState.json";

  try {
    const baseURL =
      config.projects[0].use.baseURL || process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseURL) {
      throw new Error(
        "Base URL is not defined. Please set NEXT_PUBLIC_BASE_URL environment variable.",
      );
    }

    // Sanity check server is running
    await page.goto(baseURL, { waitUntil: "networkidle", timeout: 30_000 });
    console.log("✅ Server is running and accessible");

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
    try {
      // Sometimes the full description can be rendered with subtle whitespace/newlines — match a stable prefix instead
      const descShort = en.authentication.login.description
        .split(" ")
        .slice(0, 4)
        .join(" ");
      const descShortRegex = new RegExp(escapeRegExp(descShort), "i");
      await page
        .getByText(descShortRegex, { exact: false })
        .waitFor({ timeout: 30_000 });
    } catch (err) {
      const bodyText = (await page.locator("body").textContent()) ?? "";
      console.error(
        "❌ Failed to find sign-in description. Body snippet:",
        bodyText.slice(0, 1000),
      );
      throw err;
    }

    console.log("✅ Sign-in page loaded with expected content");

    // Wait for the login form inputs to be rendered (client-side)
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });

    // Login with seed user
    await page.fill('input[name="email"]', SEED_USER.email);
    await page.fill('input[name="password"]', SEED_USER.password);

    // Wait a bit for any animations to settle
    await page.waitForTimeout(500);

    // Click with force to bypass animation stability check
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.waitFor({ state: "visible", timeout: 10_000 });
    await submitButton.click({ force: true, timeout: 10_000 });

    // Wait for redirect to dashboard
    await page.waitForURL("**/org/dashboard", { timeout: 30_000 });

    // Quick verification that dashboard is loaded
    const h1Text = (await page.locator("h1").first().textContent()) ?? "";
    if (!h1Text.includes("Dashboard")) {
      throw new Error("Dashboard heading not found after login");
    }

    // Ensure auth dir exists and save storage state for the rest of the suite
    if (!process.env.WSL_DISTRO_NAME) {
      mkdirSync("src/__tests__/e2e/.auth", { recursive: true });
    }
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
