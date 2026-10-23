import { db } from "@greendex/database";
import { member, projectsTable } from "@greendex/database/schema";
import { type Locator, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { expect } from "./artifact-privacy";

export async function projectLink(page: Page, name: string): Promise<Locator> {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.name, name));
  expect(project).toBeDefined();
  return page.locator(
    `a[href="/projects/${project!.id}"], a[href^="/projects/${project!.id}?"]`,
  );
}

export async function staffRow(page: Page, userId: string): Promise<Locator> {
  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId));
  expect(membership).toBeDefined();
  return page.getByTestId(`staff-member-${membership!.id}`);
}
