import { type Page } from "@playwright/test";

import { expect } from "./artifact-privacy";

export async function expectFirstOrganizationProjects(
  page: Page,
  _organizationName: string,
) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("organization-switcher")).toBeVisible();
  const assigned = page.getByTestId("assigned-projects");
  // Text-free: empty-state hook instead of visible copy.
  await expect(
    assigned.locator('[data-testid="assigned-projects-empty"]'),
  ).toBeVisible();
  const newProject = page.getByTestId("new-project");
  await expect(newProject).toBeEnabled();
  await newProject.click();
  const dialog = page.getByTestId("create-project-dialog");
  await expect(dialog).toBeVisible();
  const name = dialog.getByTestId("new-project-name");
  await name.fill("First Organization readiness");
  await expect(name).toHaveValue("First Organization readiness");
  await dialog.getByTestId("cancel-new-project").click();
  await expect(dialog).toBeHidden();
}
