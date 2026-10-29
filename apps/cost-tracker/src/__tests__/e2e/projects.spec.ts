import { expect, test } from "@playwright/test";

import { CostTrackerProjectFixture } from "./fixtures/cost-tracker-project";

const fixture = new CostTrackerProjectFixture();

function listURL(pageURL: string) {
  const url = new URL(pageURL);
  return `${url.pathname}${url.search}`;
}

function isRPCRequest(url: string) {
  return new URL(url).pathname.startsWith("/api/rpc");
}

test.describe("Cost Tracker Project production path", () => {
  test.beforeAll(async () => {
    await fixture.setup();
  });

  test.afterAll(async () => {
    await fixture.teardown();
  });

  test("hydrates Projects, uses the real RPC route for URL state, and restores navigation state", async ({
    page,
  }) => {
    const rpcRequests: string[] = [];
    page.on("request", (request) => {
      if (isRPCRequest(request.url())) {
        rpcRequests.push(request.url());
      }
    });

    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    // Red if server prefetch and client hydration diverge, causing an immediate RPC refetch.
    expect(rpcRequests).toHaveLength(0);

    const rpcResponse = page.waitForResponse((response) =>
      isRPCRequest(response.url()),
    );
    await page.getByTestId("project-search").fill("Cost Tracker E2E");
    await rpcResponse;
    await expect(page).toHaveURL(/search=Cost\+Tracker\+E2E/);
    await expect(
      page.locator(
        `a[href="/projects/${fixture.projectId}"], a[href^="/projects/${fixture.projectId}?"]`,
      ),
    ).toBeVisible();
    // Red if nuqs no longer writes list state to the URL or bypasses /api/rpc.
    expect(rpcRequests.length).toBeGreaterThan(0);

    const filteredListURL = listURL(page.url());
    await page.reload();
    await expect(page.getByTestId("project-search")).toHaveValue(
      "Cost Tracker E2E",
    );
    await expect(
      page.locator(
        `a[href="/projects/${fixture.projectId}"], a[href^="/projects/${fixture.projectId}?"]`,
      ),
    ).toBeVisible();
    // Red if reloading loses the URL-backed state or its matching Project data.
    expect(listURL(page.url())).toBe(filteredListURL);

    await page
      .locator(
        `a[href="/projects/${fixture.projectId}"], a[href^="/projects/${fixture.projectId}?"]`,
      )
      .click();
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      fixture.projectId,
    );
    const detailURL = page.url();
    await page.getByTestId("back-to-projects").click();
    await expect(page).toHaveURL(filteredListURL);
    // Red if Project detail no longer carries the exact local list URL home.
    await expect(page.getByTestId("project-search")).toHaveValue(
      "Cost Tracker E2E",
    );

    await page.goBack();
    await expect(page).toHaveURL(detailURL);
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      fixture.projectId,
    );
    await page.goForward();
    await expect(page).toHaveURL(filteredListURL);
    await expect(page.getByTestId("project-search")).toHaveValue(
      "Cost Tracker E2E",
    );
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        `a[href="/projects/${fixture.projectId}"], a[href^="/projects/${fixture.projectId}?"]`,
      ),
    ).toBeVisible();
  });

  test("renders protected Project routes through the Cost Tracker router and refreshes Partnerships", async ({
    page,
  }) => {
    await page.goto(`/projects/${fixture.projectId}`);
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      fixture.projectId,
    );

    await page.goto("/partner-organizations");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Text-free hook: the assignment card carries a stable test id.
    const assignment = page.locator('[data-testid="organization-assignment"]');
    await assignment
      .getByTestId("hosted-project-picker")
      .getByTestId("entity-combobox-trigger")
      .click();
    await page
      .locator('[data-slot="popover-content"][data-open]')
      .getByTestId("entity-search")
      .fill(fixture.projectId);
    await page
      .locator('[data-slot="popover-content"][data-open]')
      .locator(`[role="option"][data-entity-id="${fixture.projectId}"]`)
      .click();

    await assignment
      .getByTestId("partner-organization-picker")
      .getByTestId("entity-combobox-trigger")
      .click();
    await page
      .locator('[data-slot="popover-content"][data-open]')
      .getByTestId("entity-search")
      .fill(fixture.partnerOrganizationId);
    await page
      .locator('[data-slot="popover-content"][data-open]')
      .locator(
        `[role="option"][data-entity-id="${fixture.partnerOrganizationId}"]`,
      )
      .click();

    const rpcResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        "/api/rpc/projectPartnerships/assign",
    );
    await assignment.getByTestId("assign-partnership").click();
    expect((await rpcResponse).ok()).toBe(true);
    // Red if the mutation does not refresh the real Partnership query after a successful assignment.
    // Text-free: the refreshed row is identified by stable organization id, not copy.
    await expect(
      page.locator(
        `[data-testid="partnership-row-${fixture.partnerOrganizationId}"]`,
      ),
    ).toBeVisible();

    const dashboardResponse = await page.goto("/dashboard");
    // Red if the intentionally absent pre-release dashboard route is restored.
    expect(dashboardResponse?.status()).toBe(404);
  });
});

test("renders Organization staff controls without importing server auth into the browser", async ({
  page,
}) => {
  const response = await page.goto("/organization");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Text-free: staff controls are identified by stable test ids, not copy.
  await expect(page.locator('[data-testid="staff-members"]')).toBeVisible();
  await expect(page.locator('[data-testid="staff-invite"]')).toBeVisible();
});
