import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal harness for the instant() regression specs (#246).
 *
 * Targets public routes on a production rig with the testing API exposed:
 *
 *   EXPOSE_TESTING_API=1 pnpm build && pnpm start
 *   dotenv run -f .env -- playwright test --config=playwright.instant.config.ts
 *
 * No authenticated session: the guarded shells are all public. The main
 * suite's login-based global setup does not apply here.
 */
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
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
