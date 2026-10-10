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

  await page.goto(`${calculatorOrigin}/en/login`);
  await page.locator('input[name="email"]').fill(SEED_USER.email);
  await page.locator('input[name="password"]').fill(SEED_USER.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/org/dashboard");
  // Choose the Hosting Organization explicitly; never rely on membership order.
  const calculatorSwitcher = page.getByRole("button", {
    name: /Seed (?:Partner )?Organization/,
    exact: true,
  });
  await calculatorSwitcher.click();
  await page
    .getByRole("menuitem", { name: seed.hostingName, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: seed.hostingName, exact: true }),
  ).toBeVisible();
  await page.goto(`${calculatorOrigin}/en/org/projects/${seed.projectId}`);
  await expect(
    page.getByRole("heading", { name: seed.projectName }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: seed.hostingName, exact: true }),
  ).toBeVisible();
  const participantsTab = page.getByRole("tab", {
    name: "Project Participants",
    exact: true,
  });
  // Streaming hydration can replace the initial tab after a switch/refresh.
  // Verify the selected state, retrying this read-only interaction when needed.
  await expect(async () => {
    await participantsTab.click();
    await expect(participantsTab).toHaveAttribute("aria-selected", "true", {
      timeout: 1500,
    });
  }).toPass({ timeout: 20_000 });
  await expect(
    page.getByText(
      `Participant Journey: ${seed.origin} → ${seed.destination} · Round trip · ${Number(seed.distance)} km`,
    ),
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
    await cost.getByLabel("Email address").fill(SEED_USER.email);
    await cost.getByLabel("Password").fill(SEED_USER.password);
    await cost.getByRole("button", { name: "Sign in", exact: true }).click();
    await cost.waitForURL("**/projects");
    await cost.getByRole("button", { name: /Switch Organization/ }).click();
    await cost
      .getByRole("menuitem", { name: seed.hostingName, exact: true })
      .click();
    await expect(
      cost.getByRole("button", {
        name: `Acting Organization: ${seed.hostingName}. Switch Organization`,
      }),
    ).toBeVisible();
    await cost.goto(`${costTrackerOrigin}/projects/${seed.projectId}`);
    await expect(
      cost.getByRole("heading", { name: seed.projectName }),
    ).toBeVisible();
    await expect(cost.getByText("Hosted Project", { exact: true })).toBeVisible();
    await expect(
      cost.getByRole("button", {
        name: `Acting Organization: ${seed.hostingName}. Switch Organization`,
      }),
    ).toBeVisible();
    await expect(
      cost.getByText("Seed Partner Organization", { exact: true }),
    ).toBeVisible();
    await cost.screenshot({
      path: "src/__tests__/e2e/.playwright/merge-hosting.png",
      fullPage: true,
    });

    await cost.getByRole("button", { name: /Switch Organization/ }).click();
    await cost
      .getByRole("menuitem", { name: "Seed Partner Organization", exact: true })
      .click();
    await expect(
      cost.getByText("Partner Project", { exact: true }),
    ).toBeVisible();
    await expect(cost.getByText("Hosting Organization:")).toBeVisible();
    await cost.getByRole("link", { name: "Open Claim workspace" }).click();
    await expect(cost).toHaveURL(
      `${costTrackerOrigin}/partnerships/${seed.partnershipId}/claim`,
    );
    const workspace = cost.getByRole("region", { name: "Claim workspace" });
    await expect(
      workspace.getByText("Claim Editable draft / saved", { exact: true }),
    ).toBeVisible();
    const journey = workspace.locator(`#journey-${seed.participantId}`);
    await expect(
      journey.getByText(seed.participantName, { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByText(`${seed.origin} → ${seed.destination}`, { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByText(`${seed.distance} km`, { exact: false }),
    ).toBeVisible();
    const costRow = workspace.getByRole("row", { name: /^train / });
    await expect(
      costRow.getByRole("cell", { name: seed.amount, exact: true }),
    ).toBeVisible();
    await expect(
      costRow.getByText(`${seed.participantName}: ${seed.amount} EUR`, {
        exact: true,
      }),
    ).toBeVisible();
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
