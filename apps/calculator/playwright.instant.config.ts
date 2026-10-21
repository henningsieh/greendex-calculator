import { defineConfig, devices } from "@playwright/test";

import {
  fullBrowserConfig,
  fullBrowserUse,
} from "../../scripts/browser-test-config";

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  testMatch: "instant-shells.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL,
    storageState: { cookies: [], origins: [] },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
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
