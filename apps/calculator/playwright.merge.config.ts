import { defineConfig, devices } from "@playwright/test";

// Explicit two-app proof; the ordinary Calculator suite still needs only Calculator.
export default defineConfig({
  testDir: "./src/__tests__/merge",
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  // Covers the first Turbopack compilation of both apps on a small dev host.
  timeout: 300_000,
  expect: { timeout: 20_000 },
  outputDir: "src/__tests__/e2e/.playwright/merge-results",
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 120_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
