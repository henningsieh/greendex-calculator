import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  projectsTable,
} from "@greendex/database/schema";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
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

    const response = await page.goto(`/en-GB/org/projects/${project.id}`);
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
  });

  test("shows a public participation page for an existing project", async ({
    page,
  }) => {
    const response = await page.goto(
      `/en-GB/project/${publicProjectId}/participate`,
    );
    expect(response?.status()).toBe(200);

    await expect(page.getByTestId("participate-start")).toBeVisible();
  });

  test("archives and explicitly reopens an independent Calculator Project", async ({
    page,
  }) => {
    const seed = await db.query.organization.findFirst({
      where: eq(organization.slug, SEED_ORGANIZATION_SLUG),
    });
    if (!seed) throw new Error("Seed Organization is missing");
    const id = randomUUID();
    await db.insert(projectsTable).values({
      id,
      organizationId: seed.id,
      name: "Calculator lifecycle browser",
      location: "Berlin",
      country: "DE",
      startDate: new Date(),
      endDate: new Date(),
      costTrackerArchived: true,
    });
    try {
      await page.goto(`/en-GB/org/projects/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      for (const archived of [true, false]) {
        await page.getByTestId("project-actions").click();
        await page.getByTestId("project-lifecycle-action").click();
        await page.getByRole("alertdialog").getByRole("button").last().click();
        await expect
          .poll(
            async () =>
              (
                await db.query.projectsTable.findFirst({
                  where: eq(projectsTable.id, id),
                })
              )?.archived,
          )
          .toBe(archived);
        expect(
          (
            await db.query.projectsTable.findFirst({
              where: eq(projectsTable.id, id),
            })
          )?.costTrackerArchived,
        ).toBe(true);
        await page.reload();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      }
    } finally {
      await db.delete(projectsTable).where(eq(projectsTable.id, id));
    }
  });

  test("Admin dashboard and detail lifecycle controls require the current hosted assignment", async ({
    browser,
    baseURL,
  }) => {
    const password = randomUUID();
    await db.insert(account).values({
      id: randomUUID(),
      accountId: fixture.userId,
      userId: fixture.userId,
      providerId: "credential",
      password: await hashPassword(password),
    });
    await db
      .update(member)
      .set({ role: ORGANIZATION_ROLES.OrganizationAdmin })
      .where(eq(member.userId, fixture.userId));
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const unassignedId = randomUUID();
    try {
      const actor = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.id, fixture.userId),
      });
      if (!actor) throw new Error("Run-owned Admin is missing");
      const login = await context.request.post("/api/auth/sign-in/email", {
        data: { email: actor.email, password },
      });
      expect(login.status()).toBe(200);
      const active = await context.request.post(
        "/api/auth/organization/set-active",
        {
          headers: { Origin: baseURL! },
          data: { organizationId: fixture.orgId },
        },
      );
      expect(active.status()).toBe(200);
      await db.insert(projectsTable).values({
        id: unassignedId,
        organizationId: fixture.orgId,
        name: "Unassigned lifecycle Project",
        location: "Berlin",
        country: "DE",
        startDate: new Date(),
        endDate: new Date(),
      });
      const page = await context.newPage();
      await page.goto("/en-GB/org/dashboard?tab=projects");
      await page.getByRole("tab").nth(1).click();
      const assignedRow = page.getByRole("row").filter({
        has: page.locator(`a[href$="/projects/${fixture.projectId}"]`),
      });
      const unassignedRow = page.getByRole("row").filter({
        has: page.locator(`a[href$="/projects/${unassignedId}"]`),
      });
      await unassignedRow.getByTestId("project-actions").click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await assignedRow.getByTestId("project-actions").click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(page.getByTestId("project-lifecycle-action")).toBeEnabled();
      await page.getByTestId("project-lifecycle-action").click();
      await page.getByRole("alertdialog").getByRole("button").last().click();
      await expect
        .poll(
          async () =>
            (
              await db.query.projectsTable.findFirst({
                where: eq(projectsTable.id, fixture.projectId),
              })
            )?.archived,
        )
        .toBe(true);
      await page.goto(`/en-GB/org/projects/${fixture.projectId}`);
      await page.getByTestId("project-actions").click();
      await expect(page.getByTestId("project-lifecycle-action")).toBeEnabled();
      await page.getByTestId("project-lifecycle-action").click();
      await page.getByRole("alertdialog").getByRole("button").last().click();
      await expect
        .poll(
          async () =>
            (
              await db.query.projectsTable.findFirst({
                where: eq(projectsTable.id, fixture.projectId),
              })
            )?.archived,
        )
        .toBe(false);
      for (const archived of [false, true]) {
        await db
          .update(projectsTable)
          .set({ archived })
          .where(eq(projectsTable.id, unassignedId));
        await page.goto(`/en-GB/org/projects/${unassignedId}`);
        await page.getByTestId("project-actions").click();
        await expect(page.getByRole("menu")).toBeVisible();
        await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).toHaveCount(0);
      }
      await page.goto(`/en-GB/org/projects/${fixture.projectId}`);
      await page.getByTestId("project-actions").click();
      await page.getByTestId("project-lifecycle-action").click();
      await page.getByRole("alertdialog").getByRole("button").last().click();
      await expect
        .poll(
          async () =>
            (
              await db.query.projectsTable.findFirst({
                where: eq(projectsTable.id, fixture.projectId),
              })
            )?.archived,
        )
        .toBe(true);
      await page.goto("/en-GB/org/projects-archive");
      await unassignedRow.getByTestId("project-actions").click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await assignedRow.getByTestId("project-actions").click();
      await page.getByTestId("project-lifecycle-action").click();
      await page.getByRole("alertdialog").getByRole("button").last().click();
      await expect
        .poll(
          async () =>
            (
              await db.query.projectsTable.findFirst({
                where: eq(projectsTable.id, fixture.projectId),
              })
            )?.archived,
        )
        .toBe(false);
    } finally {
      await context.close();
      await db.delete(projectsTable).where(eq(projectsTable.id, unassignedId));
    }
  });
});
