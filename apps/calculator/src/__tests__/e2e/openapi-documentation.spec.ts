import { expect, test } from "@playwright/test";

test("renders accessible API documentation UI", async ({ page }) => {
  await page.goto("/api/docs", { timeout: 10_000 });
  await page.waitForSelector("div#app", { timeout: 10_000 });
  await page.waitForSelector("main", { timeout: 10_000 });
  await expect(page.locator("h1.section-header-label")).toContainText(
    "Greendex Calculator API",
  );
  await expect(page).toHaveTitle(/API Reference/);
});
