import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  account,
  claimsTable,
  member,
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
  session,
  user,
} from "@greendex/database/schema";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { count, inArray } from "drizzle-orm";

// API-setup exceptions: beforeAll seeds verified H/E Users, credential login,
// Organization Memberships, Projects, Project Partnerships and two Claim states.
// Rejected is a fixture precondition, NOT evidence of a browser review decision;
// the browser only observes derived readiness and never clicks Complete Project.
// No mail-sending form is submitted; sign-in uses the auth API in a private context.
// Case 27 (real payment) is NOT-RUN; all-paid Project completion in 28 is BLOCKED.
// Named server blockers are AUTOMATED-ONLY in projects.integration.test.ts.
// N2 zero-Partnership completion is NOT-RUN pending a product decision: observe
// the button only, even when it appears enabled; never click it.
const suffix = randomUUID();
const ids = {
  hostUser: randomUUID(),
  existingUser: randomUUID(),
  host: randomUUID(),
  existing: randomUUID(),
  partnerA: randomUUID(),
  partnerB: randomUUID(),
  main: randomUUID(),
  isolation: randomUUID(),
  zero: randomUUID(),
  other: randomUUID(),
  mainA: randomUUID(),
  mainB: randomUUID(),
  isolationA: randomUUID(),
  otherB: randomUUID(),
};
const names = {
  main: `CT ${suffix} Main`,
  isolation: `CT ${suffix} Isolation`,
  zero: `CT ${suffix} Zero Partnerships`,
  other: `CT ${suffix} E Other Project`,
  partnerA: `CT ${suffix} Partner A`,
  partnerB: `CT ${suffix} Partner B`,
};
const password = randomUUID();
const hostEmail = `ct-${suffix}-h@example.invalid`;
const projectIds = [ids.main, ids.isolation, ids.zero, ids.other];
const partnershipIds = [ids.mainA, ids.mainB, ids.isolationA, ids.otherB];
const organizationIds = [ids.host, ids.existing, ids.partnerA, ids.partnerB];
const userIds = [ids.hostUser, ids.existingUser];
const mainURL = `/projects/${ids.main}`;
const isolationURL = `/projects/${ids.isolation}`;
const zeroURL = `/projects/${ids.zero}`;

async function ownedCounts() {
  const [[users], [organizations], [projects], [partnerships], [claims]] =
    await Promise.all([
      db.select({ value: count() }).from(user).where(inArray(user.id, userIds)),
      db
        .select({ value: count() })
        .from(organization)
        .where(inArray(organization.id, organizationIds)),
      db
        .select({ value: count() })
        .from(projectsTable)
        .where(inArray(projectsTable.id, projectIds)),
      db
        .select({ value: count() })
        .from(projectPartnerOrganizationsTable)
        .where(inArray(projectPartnerOrganizationsTable.id, partnershipIds)),
      db
        .select({ value: count() })
        .from(claimsTable)
        .where(inArray(claimsTable.partnershipId, partnershipIds)),
    ]);
  return [
    users!.value,
    organizations!.value,
    projects!.value,
    partnerships!.value,
    claims!.value,
  ];
}

async function openHostedProject(page: Page, name: string, url: string) {
  await page.goto("/projects");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${url}(?:\\?.*)?$`));
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Hosted Project", { exact: true })).toBeVisible();
  await expect(page.getByText("Assigned Partner Organizations")).toBeVisible();
}

function partnerRow(page: Page, name: string) {
  return page.getByRole("listitem").filter({ hasText: name });
}

// Disable traces for every context in this file, including auth API requests.
test.use({ storageState: { cookies: [], origins: [] }, trace: "off" });

test.describe.serial("Project readiness journey 28 and N2", () => {
  let hostContext: Awaited<ReturnType<Browser["newContext"]>> | undefined;

  test.beforeAll(async () => {
    expect(await ownedCounts()).toEqual([0, 0, 0, 0, 0]);
    const now = new Date();
    await db.insert(user).values([
      {
        id: ids.hostUser,
        name: `CT ${suffix} H`,
        email: hostEmail,
        emailVerified: true,
      },
      {
        id: ids.existingUser,
        name: `CT ${suffix} E`,
        email: `ct-${suffix}-e@example.invalid`,
        emailVerified: true,
      },
    ]);
    await db.insert(account).values({
      id: randomUUID(),
      accountId: ids.hostUser,
      userId: ids.hostUser,
      providerId: "credential",
      password: await hashPassword(password),
    });
    await db.insert(organization).values(
      organizationIds.map((id) => ({
        id,
        name:
          id === ids.host
            ? `CT ${suffix} Hosting`
            : id === ids.existing
              ? `CT ${suffix} E Organization`
              : id === ids.partnerA
                ? names.partnerA
                : names.partnerB,
        slug: `ct-${id}`,
        createdAt: now,
      })),
    );
    await db.insert(member).values([
      {
        id: randomUUID(),
        userId: ids.hostUser,
        organizationId: ids.host,
        role: "owner",
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: ids.existingUser,
        organizationId: ids.existing,
        role: "owner",
        createdAt: now,
      },
    ]);
    await db.insert(projectsTable).values(
      (["main", "isolation", "zero", "other"] as const).map((key) => ({
        id: ids[key],
        name: names[key],
        startDate: now,
        endDate: now,
        location: "Riga",
        country: "LV" as const,
        organizationId: key === "other" ? ids.existing : ids.host,
      })),
    );
    await db.insert(projectPartnerOrganizationsTable).values([
      { id: ids.mainA, projectId: ids.main, organizationId: ids.partnerA },
      { id: ids.mainB, projectId: ids.main, organizationId: ids.partnerB },
      {
        id: ids.isolationA,
        projectId: ids.isolation,
        organizationId: ids.partnerA,
      },
      { id: ids.otherB, projectId: ids.other, organizationId: ids.partnerB },
    ]);
    // These fixture Claim states are reachable without recording any payment.
    await db.insert(claimsTable).values([
      { partnershipId: ids.mainA, status: "rejected" },
      { partnershipId: ids.otherB, status: "editable" },
    ]);
    expect(await ownedCounts()).toEqual([2, 4, 4, 4, 2]);
  });

  test.afterAll(async () => {
    await hostContext?.close();
    // All descendants of owned Projects (including Claims) cascade on deletion.
    await db.delete(projectsTable).where(inArray(projectsTable.id, projectIds));
    await db
      .delete(member)
      .where(inArray(member.organizationId, organizationIds));
    await db
      .delete(organization)
      .where(inArray(organization.id, organizationIds));
    await db.delete(session).where(inArray(session.userId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
    expect(await ownedCounts()).toEqual([0, 0, 0, 0, 0]);
  });

  test.beforeAll(async ({ browser, baseURL }) => {
    hostContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const response = await hostContext.request.post("/api/auth/sign-in/email", {
      data: { email: hostEmail, password },
    });
    expect(response.ok(), "H setup sign-in failed").toBe(true);
  });

  test("28 shows independent terminal and claimless readiness without offering completion", async () => {
    const page = await hostContext!.newPage();
    await openHostedProject(page, names.main, mainURL);
    const assigned = page.getByRole("listitem");
    await expect(assigned).toHaveCount(2);
    await expect(partnerRow(page, names.partnerA)).toContainText("Rejected");
    await expect(partnerRow(page, names.partnerB)).toContainText("No Claim");
    await expect(
      page.getByRole("button", { name: "Complete Project" }),
    ).toHaveCount(0);

    // E owns another Project with the same Partner Organization B. Its editable
    // Claim must not alter Main's B readiness or appear among H's Hosted Projects.
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: names.other })).toHaveCount(0);
    await openHostedProject(page, names.main, mainURL);
    await expect(partnerRow(page, names.partnerB)).toContainText("No Claim");
    await expect(page.getByText("Active Claim · editable")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Complete Project" }),
    ).toHaveCount(0);
  });

  test("N2 hides completion for a claimless Partnership; observes zero-Partnership control only", async () => {
    const page = await hostContext!.newPage();
    await openHostedProject(page, names.isolation, isolationURL);
    await expect(partnerRow(page, names.partnerA)).toContainText("No Claim");
    await expect(
      page.getByRole("button", { name: "Complete Project" }),
    ).toHaveCount(0);

    await openHostedProject(page, names.zero, zeroURL);
    await expect(
      page.getByText("No Partner Organizations are assigned."),
    ).toBeVisible();
    await expect(partnerRow(page, names.partnerA)).toHaveCount(0);
    // Observation only: current UI offers an enabled button for zero Partnerships.
    // Whether completing this Project is valid is unresolved; NOT-RUN, never click.
    await expect(
      page.getByRole("button", { name: "Complete Project" }),
    ).toBeEnabled();
  });
});
