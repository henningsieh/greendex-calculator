import { db } from "@greendex/database";
import { organization, projectsTable } from "@greendex/database/schema";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { TestProjectFixture } from "./fixtures/test-project";

const SEED_ORGANIZATION_SLUG = "seed-org";

async function getSeedProject() {
  const [project] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
    })
    .from(projectsTable)
    .innerJoin(organization, eq(projectsTable.organizationId, organization.id))
    .where(eq(organization.slug, SEED_ORGANIZATION_SLUG))
    .limit(1);

  if (!project) {
    throw new Error(
      `The E2E seed organization "${SEED_ORGANIZATION_SLUG}" must have a project. Run pnpm run db:seed first.`,
    );
  }

  return project;
}

test.describe("project routing", () => {
  const fixture = new TestProjectFixture();
  let publicProjectId: string;

  test.beforeAll(async () => {
    publicProjectId = await fixture.setup();
  });

  test.afterAll(async () => {
    await fixture.teardown();
  });

  test("shows an authenticated user an existing project", async ({ page }) => {
    const project = await getSeedProject();

    const response = await page.goto(`/en/org/projects/${project.id}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  });

  test("shows a public participation page for an existing project", async ({
    page,
  }) => {
    const response = await page.goto(
      `/en/project/${publicProjectId}/participate`,
    );
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("participate-start")).toBeVisible();
  });
});
