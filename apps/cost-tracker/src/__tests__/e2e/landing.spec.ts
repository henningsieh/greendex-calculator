import { expect, test } from "./fixtures/artifact-privacy";

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

// The landing page clips everything its sections cannot hold
// (main overflow-hidden), so document scrollWidth alone cannot catch a
// burst card — but the decorative aura bleed intentionally exceeds its
// section, so scrollWidth alone cannot judge either. The user-visible
// invariant is narrower: no element that can actually show a scrollbar
// (overflow-x auto/scroll) may hold overflowing content. Decorative
// bleed, visually-hidden status text, and the third-party toaster are
// allowlisted; everything else must fit or wrap.

for (const locale of ["en-GB", "de"]) {
  for (const { viewport, fontSize } of [
    { viewport: { width: 375, height: 667 }, fontSize: 24 },
    { viewport: { width: 375, height: 667 }, fontSize: 16 },
    { viewport: { width: 1280, height: 800 }, fontSize: 16 },
  ]) {
    for (const theme of ["light", "theme-erasmus-midnight"] as const) {
      test(`landing fits ${locale} ${viewport.width} ${fontSize}px ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(`/${locale}`);
        await page.evaluate(
          ({ fontSize, theme }) => {
            document.documentElement.style.fontSize = `${fontSize}px`;
            document.documentElement.classList.toggle(
              "theme-erasmus-midnight",
              theme === "theme-erasmus-midnight",
            );
            window.scrollTo(0, 0);
          },
          { fontSize, theme },
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          "no page-level horizontal scroll",
        ).toBe(true);
        const offenders = await page.evaluate(() => {
          const bad: string[] = [];
          document.querySelectorAll("*").forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.closest('[aria-hidden="true"]')) return;
            const overflowX = getComputedStyle(htmlEl).overflowX;
            if (
              (overflowX === "auto" || overflowX === "scroll") &&
              htmlEl.scrollWidth > htmlEl.clientWidth + 2
            ) {
              bad.push(
                `${el.tagName}.${(htmlEl.className?.toString() ?? "").split(" ").slice(0, 3).join(".")} scroll=${htmlEl.scrollWidth} client=${htmlEl.clientWidth}`,
              );
            }
          });
          // Bursting content that main clips instead of scrolling: these
          // regions carry no decorative bleed, so each must fit its box.
          for (const selector of [
            "main > header",
            "main footer",
            '[data-testid="claim-cost-records"]',
            "section#how-it-works",
          ]) {
            document.querySelectorAll(selector).forEach((el) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.scrollWidth > htmlEl.clientWidth + 2) {
                bad.push(
                  `BURST ${selector} scroll=${htmlEl.scrollWidth} client=${htmlEl.clientWidth}`,
                );
              }
            });
          }
          // The hero register CTAs burst their pill at large text; each
          // visible one must fit its own box.
          document.querySelectorAll('main a[href$="/register"]').forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.offsetParent === null) return;
            if (htmlEl.scrollWidth > htmlEl.clientWidth + 2) {
              const index = [
                ...document.querySelectorAll('main a[href$="/register"]'),
              ].indexOf(el);
              bad.push(
                `BURST cta #${index} scroll=${htmlEl.scrollWidth} client=${htmlEl.clientWidth}`,
              );
            }
          });
          return bad;
        });
        expect(`overflow: ${offenders.join(" | ")}`).toBe("overflow: ");
        // The header carries a desktop-only register link that is
        // display:none at 375px; only visible CTAs count.
        const heroCta = page.locator('a[href$="/register"]:visible').first();
        await expect(heroCta).toBeVisible();
        await expect(page.getByTestId("claim-total-amount")).toBeVisible();
      });
    }
  }
}

// The band subtitle carries partner names, which arrive as single
// compounds in some locales. Fixtures only use spaced names, so this
// injects an unbreakable token into the real band header and measures it
// in a real browser — jsdom cannot observe wrapping.
test("landing band wraps an unbroken subtitle at 375 24px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/en-GB");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  const band = page.locator('[data-slot="card"] > header').first();
  await expect(band).toBeVisible();
  await band.evaluate((el) => {
    const subtitle = el.querySelector("p");
    // A single 66-char token: what a spaceless compound name amounts to
    // at 24px. Built from repeat (see onboarding spec) and set through a
    // DOM API the copy-assertion policy permits.
    if (subtitle) subtitle.replaceChildren("a".repeat(66));
  });
  for (const theme of ["light", "theme-erasmus-midnight"] as const) {
    await page.evaluate((t) => {
      document.documentElement.classList.toggle(
        "theme-erasmus-midnight",
        t === "theme-erasmus-midnight",
      );
      window.scrollTo(0, 0);
    }, theme);
    expect(
      await band.evaluate((el) => el.scrollWidth <= el.clientWidth + 2),
      `band fits in ${theme}`,
    ).toBe(true);
  }
});
