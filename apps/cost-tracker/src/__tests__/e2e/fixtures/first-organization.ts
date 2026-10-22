import { type Page } from "@playwright/test";

import { expect } from "./artifact-privacy";

export async function expectFirstOrganizationProjects(
  page: Page,
  organizationName: string,
) {
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `Acting Organization: ${organizationName}. Switch Organization`,
      exact: true,
    }),
  ).toBeVisible();
  const assigned = page.getByRole("region", { name: "Assigned Projects" });
  // Text-free: empty-state hook instead of visible copy.
  await expect(
    assigned.locator('[data-testid="assigned-projects-empty"]'),
  ).toBeVisible();
  const newProject = page.getByRole("button", {
    name: "New project",
    exact: true,
  });
  await expect(newProject).toBeEnabled();
  await newProject.click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await expect(dialog).toBeVisible();
  const name = dialog.getByLabel("Name", { exact: true });
  await name.fill("First Organization readiness");
  await expect(name).toHaveValue("First Organization readiness");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();
}
