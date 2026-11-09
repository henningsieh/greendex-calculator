import { expect, test } from "./fixtures/artifact-privacy";

// #390 follow-up: the auth view announces itself by moving focus to its
// heading, so assistive technology lands in the new content. That announcement
// must not fire on a plain page load, where it only painted the global focus
// ring around a static heading.
// Text-free: assertions use test ids, roles and the live DOM focus state.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("loading the login page never focuses the heading", async ({ page }) => {
  // Record every focus change from the first paint on. A single sample after a
  // fixed delay would miss a transient focus and cannot distinguish a
  // server-rendered field from a hydrated one; the log covers the whole load.
  await page.addInitScript(() => {
    const log: string[] = [];
    Object.defineProperty(window, "__focusLog", { value: log });
    document.addEventListener(
      "focusin",
      (event) => {
        const target = event.target;
        log.push(target instanceof Element ? target.tagName : "UNKNOWN");
      },
      true,
    );
  });

  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "load" });
  await expect(page.getByTestId("email")).toBeVisible();
  // Grace window for hydration work that starts after network idle.
  await page.waitForTimeout(5_000);

  const observed = await page.evaluate(() => ({
    focusLog: (window as unknown as { __focusLog: string[] }).__focusLog,
    headingFocused: document.querySelector("h1") === document.activeElement,
    headingFocusVisible:
      document.querySelector("h1")?.matches(":focus-visible") ?? false,
  }));

  expect(observed.focusLog).not.toContain("H1");
  expect(observed.headingFocused).toBe(false);
  expect(observed.headingFocusVisible).toBe(false);
});

test("submitting the sign-up form still moves focus to the new view heading", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/register");
  const email = `focus-probe-${Date.now()}@example.org`;

  await page.getByTestId("name").fill("Focus Probe");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("SecurePassword123!");
  await page.getByTestId("auth-submit").click();

  // A real view change must still announce itself.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});
