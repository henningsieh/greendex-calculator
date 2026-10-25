import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import { organization, projectsTable } from "@greendex/database/schema";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

async function holdClientScripts(page: Page) {
  let release!: () => void;
  const scriptsAvailable = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) =>
      url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"),
    async (route) => {
      await scriptsAvailable;
      await route.continue();
    },
  );
  return release;
}

test("Project tabs accept the first available click after a slow script load", async ({
  page,
}) => {
  const [project] = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(projectsTable)
    .innerJoin(organization, eq(projectsTable.organizationId, organization.id))
    .where(eq(organization.slug, "seed-org"))
    .limit(1);
  expect(project, "Canonical Hosting Project must exist").toBeDefined();

  const release = await holdClientScripts(page);
  try {
    await page.goto(`/en/org/projects/${project.id}`, { waitUntil: "commit" });
    const participants = page.getByTestId("project-participants-tab");
    await expect(participants).toBeVisible();
    await expect(participants).toBeDisabled();
    release();
    await expect(participants).toBeEnabled();
    await participants.click();
    await expect(participants).toHaveAttribute("aria-selected", "true");
    await expect(
      page
        .getByTestId("project-participants-panel")
        .locator('[data-slot="card-title"]'),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  } finally {
    release();
  }
});

test.describe("Login readiness", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("credentials accept input and one ordinary submit after a slow script load", async ({
    page,
  }) => {
    const release = await holdClientScripts(page);
    try {
      await page.goto("/en/login", { waitUntil: "commit" });
      const email = page.locator('input[name="email"]');
      const password = page.locator('input[name="password"]');
      const submit = page.locator('button[type="submit"]');
      await expect(email).toBeVisible();
      await expect(email).toBeDisabled();
      await expect(password).toBeDisabled();
      await expect(submit).toBeDisabled();
      release();
      await expect(email).toBeEnabled();
      await expect(password).toBeEnabled();
      await email.fill(SEED_USER.email);
      await password.fill(SEED_USER.password);
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(page).toHaveURL(/\/en\/org\/dashboard$/);
      await expect(page.getByTestId("organization-dashboard")).toBeVisible();
    } finally {
      release();
    }
  });
});
