import { defineConfig, devices } from "@playwright/test";

import { playwrightRetries } from "../../scripts/playwright-retries";

/**
 * Playwright configuration for end-to-end tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: false, // Sequential execution to prevent database conflicts
  forbidOnly: true,
  retries: playwrightRetries(process.env.PLAYWRIGHT_RETRIES),
  workers: 1,
  reporter: [
    ["../../scripts/playwright-retries-reporter.ts"],
    ["html", { outputFolder: "src/__tests__/e2e/.playwright/report" }],
  ],
  outputDir: "src/__tests__/e2e/.playwright/results",
  globalSetup: "./src/__tests__/e2e/global-setup.ts",
  timeout: 60_000, // Increase global timeout for WSL Development Environments
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    storageState:
      process.env.GREENDEX_PLAYWRIGHT_AUTH ??
      "src/__tests__/e2e/.auth/storageState.json",
    trace: "off",
    screenshot: "off",
    headless: true,
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
