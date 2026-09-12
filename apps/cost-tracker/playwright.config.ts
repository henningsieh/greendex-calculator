import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.COST_TRACKER_E2E_BASE_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "http://localhost:3002";

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  globalSetup: "./src/__tests__/e2e/global-setup.ts",
  outputDir: "src/__tests__/e2e/.playwright/results",
  reporter: [["html", { outputFolder: "src/__tests__/e2e/.playwright/report" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState: "src/__tests__/e2e/.auth/storage-state.json",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
