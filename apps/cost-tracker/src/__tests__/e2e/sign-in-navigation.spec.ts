import { SEED_USER } from "@greendex/auth/seed-user";

import { expectPrivateURL, expect, test } from "./fixtures/artifact-privacy";

// MVP artifact privacy: trace/video/screenshots are off, excluding auth bodies
// from traces. URL/value checks report booleans without weakening their matches.
// Automatic DOM snapshots and reporter API diagnostics remain known risks; the
// deep guard is dormant. See docs/backlog/e2e-artifact-privacy-followup.md.
// Sign-in credentials must not be captured by retry tracing.
test.use({ trace: "off", screenshot: "off", video: "off" });

test("sign-in starts only one Projects navigation and hydrates it", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/login");
  const projectRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/projects") {
      projectRequests.push(`${request.method()} ${request.resourceType()}`);
    }
  });
  await page.getByLabel("Email address").fill(SEED_USER.email);
  await page.getByLabel("Password").fill(SEED_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Preserve the original full-URL match; only the diagnostic receives a boolean.
  await expectPrivateURL(page, /\/projects$/);
  await expect(
    page.locator('[aria-label="Project list"][data-hydrated="true"]'),
  ).toBeVisible();
  expect(projectRequests).toEqual(["GET fetch"]);
});
