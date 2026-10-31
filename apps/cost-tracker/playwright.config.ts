import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.COST_TRACKER_E2E_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL;

if (!baseURL) {
  throw new Error(
    "Set NEXT_PUBLIC_BASE_URL (or COST_TRACKER_E2E_BASE_URL) before running Cost Tracker E2E tests.",
  );
}

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  globalSetup: "./src/__tests__/e2e/global-setup.ts",
  outputDir: "src/__tests__/e2e/.playwright/results",
  reporter: [["html", { outputFolder: "src/__tests__/e2e/.playwright/report" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    storageState:
      process.env.GREENDEX_PLAYWRIGHT_AUTH ??
      "src/__tests__/e2e/.auth/storage-state.json",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
