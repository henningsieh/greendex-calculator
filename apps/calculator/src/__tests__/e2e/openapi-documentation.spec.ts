import { expect, test } from "@playwright/test";

test("renders accessible API documentation UI", async ({ page }) => {
  await page.goto("/api/docs", { timeout: 10_000 });
  await page.waitForSelector("div#app", { timeout: 10_000 });
  await page.waitForSelector("main", { timeout: 10_000 });
  // Text-free: the third-party Scalar UI renders its own heading markup,
  // so prove a non-empty title rendered instead of asserting its copy.
  const sectionTitle = page.locator("h1.section-header-label");
  await expect(sectionTitle).toBeVisible();
  await expect(sectionTitle).not.toBeEmpty();
  await expect(page).toHaveURL(/\/api\/docs$/);
});
