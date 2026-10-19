/* eslint-disable import/no-relative-parent-imports -- Repository test orchestration, not app runtime. */
import { defineConfig, devices } from "@playwright/test";

import {
  fullBrowserConfig,
  fullBrowserUse,
} from "../../scripts/browser-test-config";

/**
 * Playwright configuration for end-to-end tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testIgnore: "instant-shells.spec.ts",
  testDir: "./src/__tests__/e2e",
  fullyParallel: false, // Sequential execution to prevent database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Retry once locally for robustness
  workers: 1, // Always use 1 worker to prevent database race conditions
  reporter: [["html", { outputFolder: "src/__tests__/e2e/.playwright/report" }]],
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
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...fullBrowserUse(),
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...fullBrowserConfig(),
});
