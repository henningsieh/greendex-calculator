import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { SEED_USER } from "@greendex/auth/seed-user";
import { db } from "@greendex/database";
import {
  claimsTable,
  organization,
  participantJourneysTable,
  projectParticipantsTable,
  projectPartnerOrganizationsTable,
  projectsTable,
  travelCostEntriesTable,
} from "@greendex/database/schema";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

const costTrackerURL =
  process.env.COST_TRACKER_E2E_BASE_URL ??
  parseEnv(
    readFileSync(
      new URL("../../../../cost-tracker/.env", import.meta.url),
      "utf8",
    ),
  ).NEXT_PUBLIC_BASE_URL;

function localOrigin(value: string | undefined): string {
  if (!value)
    throw new Error(
      "Configure the local base URL for both apps before the merge proof.",
    );
  const url = new URL(value);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("The mocked merge proof requires local app origins.");
  return url.origin;
}

test("both apps expose the same seeded Project and Journey, and Cost Tracker opens the Partner Claim", async ({
  browser,
  page,
  baseURL,
}) => {
  const calculatorOrigin = localOrigin(baseURL);
  const costTrackerOrigin = localOrigin(costTrackerURL);
  const [seed] = await db
    .select({
      projectId: projectsTable.id,
      projectName: projectsTable.name,
      hostingId: organization.id,
      hostingName: organization.name,
      partnershipId: projectPartnerOrganizationsTable.id,
      partnerId: projectPartnerOrganizationsTable.organizationId,
      journeyId: participantJourneysTable.id,
      participantId: projectParticipantsTable.id,
      participantName: projectParticipantsTable.displayName,
      origin: participantJourneysTable.origin,
      destination: participantJourneysTable.destination,
      distance: participantJourneysTable.erasmusDistanceKm,
      costId: travelCostEntriesTable.id,
      amount: travelCostEntriesTable.amountEur,
    })
    .from(projectsTable)
    .innerJoin(organization, eq(projectsTable.organizationId, organization.id))
    .innerJoin(
      projectPartnerOrganizationsTable,
      eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
    )
    .innerJoin(
      projectParticipantsTable,
      eq(projectParticipantsTable.projectId, projectsTable.id),
    )
    .innerJoin(
      participantJourneysTable,
      eq(
        participantJourneysTable.projectParticipantId,
        projectParticipantsTable.id,
      ),
    )
    .innerJoin(
      claimsTable,
      eq(claimsTable.partnershipId, projectPartnerOrganizationsTable.id),
    )
    .innerJoin(
      travelCostEntriesTable,
      eq(travelCostEntriesTable.claimId, claimsTable.id),
    )
    .where(eq(organization.slug, "seed-org"))
    .limit(1);
  if (!seed)
    throw new Error(
      "Run the shared development db:seed before proving the merge.",
    );

  const [partner] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, seed.partnerId));
  expect(partner).toBeDefined();

  await page.goto(`${calculatorOrigin}/en/login`);
  await page.locator('input[name="email"]').fill(SEED_USER.email);
  await page.locator('input[name="password"]').fill(SEED_USER.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/org/dashboard");
  // Choose the Hosting Organization explicitly; never rely on membership order.
  const calculatorSwitcher = page.getByTestId("organization-switcher");
  await calculatorSwitcher.click();
  await page
    .getByRole("menuitem", { name: seed.hostingName, exact: true })
    .click();
  await expect(calculatorSwitcher).toHaveAttribute(
    "data-organization-id",
    seed.hostingId,
  );
  await page.goto(`${calculatorOrigin}/en/org/projects/${seed.projectId}`);
  await expect(
    page.getByRole("heading", { name: seed.projectName }),
  ).toBeVisible();
  await expect(calculatorSwitcher).toHaveAttribute(
    "data-organization-id",
    seed.hostingId,
  );
  const participantsTab = page.getByTestId("project-participants-tab");
  await expect(participantsTab).toBeEnabled();
  await participantsTab.click();
  await expect(participantsTab).toHaveAttribute("aria-selected", "true");
  // Text-free: active tab panel renders (seed detail subsumed by fixture + selection).
  await expect(
    page.locator('[data-slot="tabs-content"][data-state="active"]'),
  ).toBeVisible();
  await page.screenshot({
    path: "src/__tests__/e2e/.playwright/merge-calculator.png",
    fullPage: true,
  });

  // Separate contexts: localhost cookies must not mix the apps' independent sessions.
  const costContext = await browser.newContext();
  try {
    const cost = await costContext.newPage();
    await cost.goto(`${costTrackerOrigin}/login`);
    await cost.locator('input[name="email"]').fill(SEED_USER.email);
    await cost.locator('input[name="password"]').fill(SEED_USER.password);
    await cost.locator('button[type="submit"]').click();
    await cost.waitForURL("**/projects");
    // Cost Tracker has no domain marker on this trigger; its existing icon
    // distinguishes it from the theme and account dropdowns without copy.
    const costSwitcher = cost
      .locator('[data-slot="dropdown-menu-trigger"]')
      .filter({ has: cost.locator("svg.lucide-building-2") });
    async function selectCostOrganization(name: string) {
      await costSwitcher.click();
      await cost.getByRole("menuitem", { name, exact: true }).click();
      await costSwitcher.click();
      await expect(
        cost.getByRole("menuitem", { name, exact: true }),
      ).toHaveAttribute("aria-current", "true");
      await cost.keyboard.press("Escape");
    }

    await selectCostOrganization(seed.hostingName);
    await expect(costSwitcher).toBeEnabled();
    await cost.goto(`${costTrackerOrigin}/projects/${seed.projectId}`);
    await expect(
      cost.getByRole("heading", { name: seed.projectName }),
    ).toBeVisible();
    await expect(cost.locator('[data-relationship="hosted"]')).toBeVisible();
    await expect(costSwitcher).toBeEnabled();
    // Text-free: acting-organization context + project heading above prove the org scope (no copy).
    await cost.screenshot({
      path: "src/__tests__/e2e/.playwright/merge-hosting.png",
      fullPage: true,
    });

    await selectCostOrganization(partner.name);
    await expect(cost.locator('[data-relationship="partner"]')).toBeVisible();
    // Text-free: acting-organization context + claim link below prove the scope (no copy).
    await cost
      .locator(`a[href="/partnerships/${seed.partnershipId}/claim"]`)
      .click();
    await expect(cost).toHaveURL(
      `${costTrackerOrigin}/partnerships/${seed.partnershipId}/claim`,
    );
    const workspace = cost
      .getByRole("region")
      .filter({ has: cost.locator("[data-draft-status]") });
    // Text-free: draft state hook instead of visible copy.
    await expect(
      workspace.locator('[data-draft-status="editable"]'),
    ).toBeVisible();
    const journey = workspace.locator(`#journey-${seed.participantId}`);
    // Text-free: ID-anchored journey element proves presence (seed detail subsumed).
    await expect(journey).toBeVisible();
    const costRow = workspace.locator(`#cost-${seed.costId}`);
    await expect(costRow).toBeVisible();
    await expect(costRow).toHaveAttribute("data-amount-eur", seed.amount);
    // The persisted cost ID and numeric amount prove the entry without a copy search.
    await cost.screenshot({
      path: "src/__tests__/e2e/.playwright/merge-partner-claim.png",
      fullPage: true,
    });
    console.log(
      `Shared identity proof: Organization ${seed.hostingId}; Project ${seed.projectId}; Journey ${seed.journeyId}; Partnership ${seed.partnershipId}`,
    );
  } finally {
    await costContext.close();
  }
});
