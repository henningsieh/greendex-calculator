import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { SEED_USER } from "@greendex/auth/seed-user";
import { chromium, expect, type FullConfig } from "@playwright/test";

const storageStatePath =
  process.env.GREENDEX_PLAYWRIGHT_AUTH ??
  "src/__tests__/e2e/.auth/storage-state.json";

export default async function globalSetup(config: FullConfig) {
  // Policy: e2e runs against production builds only — never next dev.
  // The managed runner sets this once its production target is verified;
  // set it by hand only after `next build` + `next start`, never for dev.
  if (process.env.GREENDEX_E2E_PRODUCTION_OK !== "1") {
    throw new Error(
      "Refusing e2e: target must be a production build (next build + next start) or a managed test-runner server — never next dev. " +
        "Set GREENDEX_E2E_PRODUCTION_OK=1 only after starting a production artifact.",
    );
  }
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Cost Tracker E2E base URL is not configured.");
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(new URL("/login", baseURL).toString());
    await page.getByLabel("Email address").fill(SEED_USER.email);
    await page.getByLabel("Password").fill(SEED_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/projects");
    // waitForURL observes the navigation start, not the streamed page finish.
    // Closing this browser while its RSC response is still rendering aborts it.
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    await mkdir(dirname(storageStatePath), { recursive: true, mode: 0o700 });
    await page.context().storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}
