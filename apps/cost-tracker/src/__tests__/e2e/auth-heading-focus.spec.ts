import { expect, test } from "./fixtures/artifact-privacy";

// #390 follow-up: the auth view announces itself by moving focus to its
// heading, so assistive technology lands in the new content. That announcement
// must not fire on a plain page load, where it only painted the global focus
// ring around a static heading.
// Text-free: assertions use test ids, roles and the live DOM focus state.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("loading the login page leaves focus alone", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  // Wait for hydration, then for the window in which the old effect grabbed
  // focus. Anything it does happens well inside this budget.
  await expect(page.getByTestId("email")).toBeVisible();
  await page.waitForTimeout(5_000);

  const state = await page.evaluate(() => {
    const heading = document.querySelector("h1");
    return {
      headingFocused: heading !== null && heading === document.activeElement,
      headingFocusVisible: heading?.matches(":focus-visible") ?? false,
    };
  });

  expect(state.headingFocused).toBe(false);
  expect(state.headingFocusVisible).toBe(false);
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
