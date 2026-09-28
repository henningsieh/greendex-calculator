import { expect, test } from "@playwright/test";

// oxlint-disable-next-line import/no-relative-parent-imports -- Reuses the seeded test identity.
import { SEED_USER } from "../../../../calculator/scripts/seed-user";

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
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.locator('[aria-label="Project list"][data-hydrated="true"]'),
  ).toBeVisible();
  expect(projectRequests).toEqual(["GET fetch"]);
});
