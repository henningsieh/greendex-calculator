import { expect, test } from "@playwright/test";

import { CostTrackerProjectFixture } from "./fixtures/cost-tracker-project";

const fixture = new CostTrackerProjectFixture();

function collectionURL(pageURL: string) {
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
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await page.waitForTimeout(500);
    // Red if server prefetch and client hydration diverge, causing an immediate RPC refetch.
    expect(rpcRequests).toHaveLength(0);

    const rpcResponse = page.waitForResponse((response) =>
      isRPCRequest(response.url()),
    );
    await page.getByLabel("Project name").fill("Cost Tracker E2E");
    await rpcResponse;
    await expect(page).toHaveURL(/search=Cost\+Tracker\+E2E/);
    await expect(page.getByText(fixture.name)).toBeVisible();
    // Red if nuqs no longer writes collection state to the URL or bypasses /api/rpc.
    expect(rpcRequests.length).toBeGreaterThan(0);

    const filteredCollectionURL = collectionURL(page.url());
    await page.reload();
    await expect(page.getByLabel("Project name")).toHaveValue("Cost Tracker E2E");
    await expect(page.getByText(fixture.name)).toBeVisible();
    // Red if reloading loses the URL-backed state or its matching Project data.
    expect(collectionURL(page.url())).toBe(filteredCollectionURL);

    await page.getByRole("link", { name: fixture.name }).click();
    await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();
    await page.getByRole("link", { name: "Back to Projects" }).click();
    await expect(page).toHaveURL(filteredCollectionURL);
    // Red if Project detail no longer carries the exact local collection URL home.
    await expect(page.getByLabel("Project name")).toHaveValue("Cost Tracker E2E");

    await page.goBack();
    await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(filteredCollectionURL);
    // Red if browser Back/Forward cannot restore the hydrated collection state.
    await expect(page.getByText(fixture.name)).toBeVisible();
  });

  test("renders protected Project routes through the Cost Tracker router and refreshes Partnerships", async ({
    page,
  }) => {
    await page.goto(`/projects/${fixture.projectId}`);
    await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

    await page.goto("/partner-organizations");
    await expect(
      page.getByRole("heading", { name: "Partner Organizations" }),
    ).toBeVisible();

    const rpcResponse = page.waitForResponse((response) =>
      isRPCRequest(response.url()),
    );
    await page.getByLabel("Hosted Project ID").fill(fixture.projectId);
    await page
      .getByLabel("Partner Organization ID")
      .fill(fixture.partnerOrganizationId);
    await page.getByRole("button", { name: "Assign" }).click();
    await rpcResponse;
    // Red if the mutation does not refresh the real Partnership query after a successful assignment.
    await expect(page.getByText(fixture.partnerOrganizationName)).toBeVisible();

    const dashboardResponse = await page.goto("/dashboard");
    // Red if the intentionally absent pre-release dashboard route is restored.
    expect(dashboardResponse?.status()).toBe(404);
  });
});
