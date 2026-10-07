import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

/**
 * Instant-navigation regression guards for the statically adopted routes
 * (#246).
 *
 * `instant()` gates dynamic data, so each test below proves the route's
 * static shell commits under the lock. These run against a production
 * build with the testing API exposed:
 *
 *   EXPOSE_TESTING_API=1 pnpm build && pnpm start
 *   pnpm exec playwright test instant-shells
 *
 * Public routes only — no authenticated session is established, so a
 * route that redirects to login fails here by design (and must keep
 * failing: it is deliberately blocking).
 */
test.describe("instant initial load: static shells", () => {
  test("landing shell is served", async ({ page }) => {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/en`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        await expect(page.getByTestId("landing-hero-heading")).toBeVisible();
      },
      { baseURL: new URL(url).origin },
    );
  });

  test("about shell is served", async ({ page }) => {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/en/about`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        await expect(page.getByTestId("about-heading")).toBeVisible();
      },
      { baseURL: new URL(url).origin },
    );
  });

  test("workshops shell commits while tab state stays gated", async ({
    page,
  }) => {
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/en/workshops`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        // Static shell asserted under the lock ...
        await expect(page.getByTestId("workshops-shell-marker")).toBeVisible();
        // ... while the search-param-driven tab content stays gated.
        await expect(page.getByTestId("workshops-content")).toHaveCount(0);
      },
      { baseURL: new URL(url).origin },
    );
    // Streams after the lock releases.
    await expect(page.getByTestId("workshops-content")).toBeVisible();
  });
});
