import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  organization,
  projectsTable,
} from "@greendex/database/schema";
import de from "@greendex/i18n/locales/de.json" with { type: "json" };
import en from "@greendex/i18n/locales/en.json" with { type: "json" };
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

const SEED_ORGANIZATION_SLUG = "seed-org";
const sharedTravelLegDescription = `Shared travel E2E ${randomUUID()}`;

async function createProjectForSeedOrganization() {
  const [seedProject] = await db
    .select({
      organizationId: projectsTable.organizationId,
      hostUserId: hostProjectAssignmentsTable.userId,
    })
    .from(projectsTable)
    .innerJoin(organization, eq(projectsTable.organizationId, organization.id))
    .innerJoin(
      hostProjectAssignmentsTable,
      eq(hostProjectAssignmentsTable.projectId, projectsTable.id),
    )
    .where(eq(organization.slug, SEED_ORGANIZATION_SLUG))
    .limit(1);

  if (!seedProject) {
    throw new Error(
      `The E2E seed organization "${SEED_ORGANIZATION_SLUG}" must have a project. Run pnpm run db:seed first.`,
    );
  }

  const projectId = randomUUID();
  await db.insert(projectsTable).values({
    id: projectId,
    name: `Shared Travel E2E ${projectId}`,
    location: "Berlin",
    country: "DE",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-05"),
    organizationId: seedProject.organizationId,
  });

  await db.insert(hostProjectAssignmentsTable).values({
    projectId,
    userId: seedProject.hostUserId,
  });

  return projectId;
}

test.describe("Project Shared Travel Legs", () => {
  let projectId: string;
  let createdProjectId: string | undefined;

  test.beforeEach(async () => {
    projectId = await createProjectForSeedOrganization();
    createdProjectId = undefined;
  });

  test.afterEach(async () => {
    if (createdProjectId) {
      await db
        .delete(projectsTable)
        .where(eq(projectsTable.id, createdProjectId));
    }
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  });

  test("creates a project with an electric-car shared travel leg", async ({
    page,
  }) => {
    const projectName = `Created shared travel ${randomUUID()}`;
    const description = `Electric transfer ${randomUUID()}`;

    await page.goto("/en/org/create-project");
    await page
      .getByLabel(en.organization.projects.form.new.name)
      .fill(projectName);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /Germany/ }).click();
    await page
      .getByRole("button", { name: en.project["shared-travel"].title })
      .click();

    await page
      .getByRole("button", { name: en.project["shared-travel"].form.title })
      .click();
    await page
      .getByLabel(en.project["shared-travel"].form["transport-emission-profile"])
      .click();
    await page
      .getByRole("option", {
        name: en.project["shared-travel"].types.electricCar,
      })
      .click();
    await page
      .getByLabel(en.project["shared-travel"].form.distance)
      .fill("120.5");
    await page
      .getByLabel(en.project["shared-travel"].form.description)
      .fill(description);
    await expect(
      page.getByLabel(en.project["shared-travel"].form["travel-date"]),
    ).toBeVisible();

    await page
      .getByRole("button", {
        name: en.organization.projects.form.new["create-project"],
      })
      .click();
    await page.waitForURL(/\/en\/org\/projects\/[\w-]+$/);

    const url = new URL(page.url());
    createdProjectId = url.pathname.split("/").at(-1);

    const sharedTravelTab = page.getByRole("tab", {
      name: en.project.details.tabs["shared-travel"],
    });
    await sharedTravelTab.click();
    const sharedTravelLegRow = page
      .getByRole("row")
      .filter({ hasText: description });
    await expect(sharedTravelLegRow).toContainText(
      en.project["shared-travel"].types.electricCar,
    );

    const editedProjectName = `${projectName} edited`;
    await page
      .getByRole("button", {
        name: en.organization.projects.form.edit.title,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: en.organization.projects.table["edit-project"],
      })
      .click();

    const editDialog = page.getByRole("dialog");
    await editDialog
      .getByLabel(en.organization.projects.form.new.name)
      .fill(editedProjectName);
    await editDialog
      .getByRole("button", { name: en.project["shared-travel"].title })
      .click();
    await editDialog
      .getByRole("button", { name: en.organization.projects.form.edit.update })
      .click();

    await expect(
      page.getByRole("heading", { name: editedProjectName }),
    ).toBeVisible();
    await expect(sharedTravelLegRow).toContainText(
      en.project["shared-travel"].types.electricCar,
    );
  });

  test("switches project-detail tabs and renders their content", async ({
    page,
  }) => {
    await page.goto(`/en/org/projects/${projectId}`);
    // The route is server-rendered; wait for its client-side tab controls to hydrate.
    await page.waitForTimeout(2_000);

    const detailsTab = page.getByRole("tab", {
      name: en.project.details.tabs.details,
    });
    const sharedTravelTab = page.getByRole("tab", {
      name: en.project.details.tabs["shared-travel"],
    });
    const participantsTab = page.getByRole("tab", {
      name: en.project.details.tabs.participants,
    });

    await expect(detailsTab).toHaveAttribute("data-state", "active");

    await sharedTravelTab.click();
    await expect(sharedTravelTab).toHaveAttribute("data-state", "active");
    await expect(
      page.locator('[data-slot="card-title"]', {
        hasText: en.project["shared-travel"].title,
      }),
    ).toBeVisible();

    await participantsTab.click();
    await expect(participantsTab).toHaveAttribute("data-state", "active");
    await expect(
      page.locator('[data-slot="card-title"]', {
        hasText: en.project.details.participants,
      }),
    ).toBeVisible();

    await detailsTab.click();
    await expect(detailsTab).toHaveAttribute("data-state", "active");
  });

  test("allows an Organization Administrator to manage electric-car shared travel", async ({
    page,
  }) => {
    await page.goto(`/en/org/projects/${projectId}`);
    // The route is server-rendered; wait for its client-side tab controls to hydrate.
    await page.waitForTimeout(2_000);
    const sharedTravelTab = page.getByRole("tab", {
      name: en.project.details.tabs["shared-travel"],
    });
    await sharedTravelTab.click();
    await expect(sharedTravelTab).toHaveAttribute("data-state", "active");

    await expect(
      page.locator('[data-slot="card-title"]', {
        hasText: en.project["shared-travel"].title,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(en.project["shared-travel"].empty.title, { exact: true }),
    ).toBeVisible();

    await page.getByLabel(en.project["shared-travel"].form.title).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: en.project["shared-travel"].form.title,
      }),
    ).toBeVisible();

    await dialog
      .getByLabel(en.project["shared-travel"].form["transport-emission-profile"])
      .click();
    await expect(
      page.getByRole("option", {
        name: en.project["shared-travel"].types.electricCar,
      }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "Plane" })).toHaveCount(0);
    await page
      .getByRole("option", {
        name: en.project["shared-travel"].types.electricCar,
      })
      .click();

    await dialog
      .getByLabel(en.project["shared-travel"].form.distance)
      .fill("123.4");
    await dialog
      .getByLabel(en.project["shared-travel"].form.description)
      .fill(sharedTravelLegDescription);
    await expect(
      dialog.getByLabel(en.project["shared-travel"].form["travel-date"]),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: en.project["shared-travel"].form.submit })
      .click();

    const sharedTravelLegRow = page
      .getByRole("row")
      .filter({ hasText: sharedTravelLegDescription });
    await expect(sharedTravelLegRow).toContainText(
      en.project["shared-travel"].types.electricCar,
    );
    await expect(sharedTravelLegRow).toContainText("123.4");

    await sharedTravelLegRow
      .getByRole("button", { name: en.project["shared-travel"].table.edit })
      .click();
    await dialog
      .getByLabel(en.project["shared-travel"].form.description)
      .fill(`${sharedTravelLegDescription} updated`);
    await dialog
      .getByRole("button", { name: en.project["shared-travel"].form.update })
      .click();

    const updatedSharedTravelLegRow = page
      .getByRole("row")
      .filter({ hasText: `${sharedTravelLegDescription} updated` });
    await expect(updatedSharedTravelLegRow).toContainText(
      en.project["shared-travel"].types.electricCar,
    );

    await updatedSharedTravelLegRow
      .getByRole("button", { name: en.project["shared-travel"].table.delete })
      .click();
    const confirmation = page.getByRole("alertdialog");
    await expect(
      confirmation.getByRole("heading", {
        name: en.project["shared-travel"].delete["confirm-title"],
      }),
    ).toBeVisible();
    await confirmation
      .getByRole("button", {
        name: en.project["shared-travel"].delete["confirm-button"],
      })
      .click();

    await expect(
      page.getByText(`${sharedTravelLegDescription} updated`),
    ).toHaveCount(0);
  });

  test("renders shared-travel translations from the active locale", async ({
    page,
  }) => {
    for (const [locale, messages] of [
      ["en", en],
      ["de", de],
    ] as const) {
      await page.goto(`/${locale}/org/projects/${projectId}`);
      // The route is server-rendered; wait for its client-side tab controls to hydrate.
      await page.waitForTimeout(2_000);
      const sharedTravelTab = page.getByRole("tab", {
        name: messages.project.details.tabs["shared-travel"],
      });
      await sharedTravelTab.click();
      await expect(sharedTravelTab).toHaveAttribute("data-state", "active");

      await expect(
        page.locator('[data-slot="card-title"]', {
          hasText: messages.project["shared-travel"].title,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.project["shared-travel"].empty.title, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.project["shared-travel"].empty.description, {
          exact: true,
        }),
      ).toBeVisible();

      await page.getByLabel(messages.project["shared-travel"].form.title).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", {
          name: messages.project["shared-travel"].form.title,
        }),
      ).toBeVisible();
      await expect(
        dialog.getByLabel(
          messages.project["shared-travel"].form["transport-emission-profile"],
        ),
      ).toBeVisible();
      await expect(
        dialog.getByLabel(messages.project["shared-travel"].form["travel-date"]),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Close" }).click();
    }
  });
});
