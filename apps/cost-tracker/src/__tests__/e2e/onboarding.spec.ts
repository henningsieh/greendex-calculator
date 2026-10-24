import { expect, test } from "./fixtures/artifact-privacy";

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
]) {
  test(`email signup replaces the form with above-fold progress at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    // The browser seam isolates presentation without sending real verification mail.
    await page.route("**/api/rpc/authentication/signUp", (route) =>
      route.fulfill({ json: { json: { success: true } } }),
    );
    await page.goto("/register");
    await page.getByLabel("Name", { exact: true }).fill("Alex Morgan");
    await page.getByLabel("Email address").fill(`${"a".repeat(64)}@example.org`);
    await page.getByLabel("Password", { exact: true }).fill("example-password");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    const progress = page.getByTestId("auth-verification-message");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("role", "status");
    await expect(progress).toHaveAttribute("data-emphasis", "prominent");
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    const bounds = await progress.boundingBox();
    expect(
      bounds !== null &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= viewport.height,
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("invitation registration keeps its continuation on Google and account navigation", async ({
  page,
}) => {
  await page.goto("/register?next=%2Faccept-invitation%2Fexample-invitation");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute(
    "href",
    "/login?next=%2Faccept-invitation%2Fexample-invitation",
  );
  const [request] = await Promise.all([
    page.waitForRequest("**/api/rpc/authentication/startGoogleSignIn"),
    page.route("**/api/rpc/authentication/startGoogleSignIn", (route) =>
      route.fulfill({
        json: { json: { url: new URL("/login", page.url()).href } },
      }),
    ),
    page.getByRole("button", { name: "Continue with Google" }).click(),
  ]);
  expect(request.postDataJSON()).toEqual({
    json: { returnTo: "/accept-invitation/example-invitation" },
  });
});
