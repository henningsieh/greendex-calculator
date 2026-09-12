import { mkdir } from "node:fs/promises";

import { chromium, type FullConfig } from "@playwright/test";

// oxlint-disable-next-line import/no-relative-parent-imports -- Uses the canonical side-effect-free seed identity.
import { SEED_USER } from "../../../../calculator/scripts/seed-user";

const storageStatePath = "src/__tests__/e2e/.auth/storage-state.json";

export default async function globalSetup(config: FullConfig) {
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

    await mkdir("src/__tests__/e2e/.auth", { recursive: true });
    await page.context().storageState({ path: storageStatePath });
  } finally {
    await browser.close();
  }
}
