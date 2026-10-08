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

  test("workshops navigation holds gated tab state under the lock", async ({
    page,
  }) => {
    // Client navigation from the landing page through the ?type=deal card
    // exercises the search-param read end to end. Under the lock the
    // navigation is held — shell and tab content stay absent until
    // release — so the lock engagement is proven by the test itself:
    // without the lock the navigation commits immediately and the
    // in-scope assertions go RED. The post-release assertions go RED if a
    // newly introduced blocking read stops the deferred content from
    // streaming.
    // (A bare page.goto cannot gate this page: its deferred read resolves
    // from the request itself, so the MPA document already carries the
    // content before the client lock can engage. Only the
    // client-navigation path holds the gated UI back under the lock.)
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL;
    await page.goto(`${baseURL}/en`);
    await expect(page.getByTestId("landing-hero-heading")).toBeVisible();
    const dealCard = page.locator('a[href="/en/workshops?type=deal"]');
    // Let the link prefetch (viewport + hover) so the held navigation can
    // complete promptly once the lock releases.
    await dealCard.scrollIntoViewIfNeeded();
    await dealCard.hover();
    await expect
      .poll(
        async () =>
          await page.evaluate(() =>
            performance
              .getEntriesByType("resource")
              .some(
                (r) =>
                  r.name.includes("/en/workshops?type=deal") &&
                  r.name.includes("_rsc"),
              ),
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    await instant(page, async () => {
      await dealCard.click();
      // Give an unlocked navigation ample time to commit; under the lock
      // nothing may commit.
      await page.waitForTimeout(4000);
      expect(page.url()).toBe(`${baseURL}/en`);
      await expect(page.getByTestId("workshops-shell-marker")).toHaveCount(0);
      await expect(page.getByTestId("workshops-content")).toHaveCount(0);
    });
    await page.waitForURL((url) => url.pathname === "/en/workshops", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("workshops-content")).toBeVisible();
    await expect(page.getByRole("tab", { selected: true })).toContainText(
      /deal/i,
    );
  });
});
