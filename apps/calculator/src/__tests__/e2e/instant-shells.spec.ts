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
    // ?type=deal exercises the search-param read end to end. All inputs
    // here resolve from the request itself (concrete search params,
    // static messages, client-side tab state), so shell and content both
    // commit under the lock; any newly introduced blocking read in either
    // turns this RED. Lock engagement itself is proven by the rig build,
    // whose log must show `exposeTestingApiInProductionBuild`.
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/en/workshops?type=deal`;
    await instant(
      page,
      async () => {
        await page.goto(url);
        await expect(page.getByTestId("workshops-shell-marker")).toBeVisible();
        await expect(page.getByTestId("workshops-content")).toBeVisible();
        await expect(page.getByRole("tab", { selected: true })).toContainText(
          /deal/i,
        );
      },
      { baseURL: new URL(url).origin },
    );
  });
});
