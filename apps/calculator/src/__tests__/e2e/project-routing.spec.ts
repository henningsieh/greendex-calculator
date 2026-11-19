import { randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  account,
  member,
  organization,
  projectsTable,
  hostProjectAssignmentsTable,
} from "@greendex/database/schema";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

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

  for (const journey of ["active", "archive"] as const)
    test(`Admin ${journey} lifecycle controls require the current hosted assignment`, async ({
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
        if (journey === "active") {
          await unassignedRow.getByTestId("project-actions").click();
          await expect(page.getByRole("menu")).toBeVisible();
          await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(
            0,
          );
          await page.keyboard.press("Escape");
          await expect(page.getByRole("menu")).toHaveCount(0);
          await assignedRow.getByTestId("project-actions").click();
          await expect(page.getByRole("menu")).toBeVisible();
          await expect(
            page.getByTestId("project-lifecycle-action"),
          ).toBeEnabled();
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
          await expect(
            page.getByTestId("project-lifecycle-action"),
          ).toBeEnabled();
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
            await expect(
              page.getByTestId("project-lifecycle-action"),
            ).toHaveCount(0);
            await page.keyboard.press("Escape");
            await expect(page.getByRole("menu")).toHaveCount(0);
          }
        } else {
          await db
            .update(projectsTable)
            .set({ archived: true })
            .where(eq(projectsTable.id, unassignedId));
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
          await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(
            0,
          );
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
        }
      } finally {
        try {
          await context.close();
        } finally {
          await db
            .delete(projectsTable)
            .where(eq(projectsTable.id, unassignedId));
          await db.delete(account).where(eq(account.userId, fixture.userId));
        }
      }
    });
});

for (const surface of ["detail", "list"] as const) {
  for (const failure of ["refusal", "network"] as const) {
    test(`refreshes ${surface} lifecycle availability after ${failure} only when refused`, async ({
      browser,
      baseURL,
    }) => {
      const fixture = new TestProjectFixture();
      const password = randomUUID();
      await fixture.setup();
      const context = await browser.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
      });
      try {
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
        const actor = await db.query.user.findFirst({
          where: (users, { eq }) => eq(users.id, fixture.userId),
        });
        if (!actor) throw new Error("Run-owned Admin is missing");
        expect(
          (
            await context.request.post("/api/auth/sign-in/email", {
              data: { email: actor.email, password },
            })
          ).status(),
        ).toBe(200);
        expect(
          (
            await context.request.post("/api/auth/organization/set-active", {
              headers: { Origin: baseURL! },
              data: { organizationId: fixture.orgId },
            })
          ).status(),
        ).toBe(200);
        const page = await context.newPage();
        if (surface === "detail") {
          await page.goto(`/en-GB/org/projects/${fixture.projectId}`);
          await page.getByTestId("project-actions").click();
        } else {
          await page.goto("/en-GB/org/dashboard?tab=projects");
          await page.getByRole("tab").nth(1).click();
          await page
            .getByRole("row")
            .filter({
              has: page.locator(`a[href$="/projects/${fixture.projectId}"]`),
            })
            .getByTestId("project-actions")
            .click();
        }
        await expect(page.getByTestId("project-lifecycle-action")).toBeVisible();
        if (failure === "refusal") {
          await db
            .delete(hostProjectAssignmentsTable)
            .where(
              and(
                eq(hostProjectAssignmentsTable.projectId, fixture.projectId),
                eq(hostProjectAssignmentsTable.userId, fixture.userId),
              ),
            );
        } else {
          await page.route("**/projects/archive", (route) => route.abort());
        }
        const queryPath =
          surface === "detail" ? "/projects/getById" : "/projects/list";
        let refreshes = 0;
        page.on("request", (request) => {
          if (request.url().includes(queryPath)) refreshes++;
        });
        const response =
          failure === "refusal"
            ? page.waitForResponse(
                (response) =>
                  response.url().includes("/projects/archive") &&
                  response.status() === 403,
              )
            : null;
        await page.getByTestId("project-lifecycle-action").click();
        await page.getByRole("alertdialog").getByRole("button").last().click();
        if (response) await response;
        await expect(
          page.locator("[data-sonner-toast][data-type=error]"),
        ).toBeVisible();
        if (failure === "refusal")
          await expect.poll(() => refreshes).toBeGreaterThan(0);
        else expect(refreshes).toBe(0);
        if (surface === "detail")
          await page.getByTestId("project-actions").click();
        else
          await page
            .getByRole("row")
            .filter({
              has: page.locator(`a[href$="/projects/${fixture.projectId}"]`),
            })
            .getByTestId("project-actions")
            .click();
        if (failure === "refusal")
          await expect(page.getByTestId("project-lifecycle-action")).toHaveCount(
            0,
          );
        else
          await expect(
            page.getByTestId("project-lifecycle-action"),
          ).toBeVisible();
      } finally {
        try {
          await context.close();
        } finally {
          await fixture.teardown();
        }
      }
    });
  }
}
