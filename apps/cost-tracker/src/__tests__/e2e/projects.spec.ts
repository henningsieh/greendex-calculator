import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import { projectsTable } from "@greendex/database/schema";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";

import { CostTrackerProjectFixture } from "./fixtures/cost-tracker-project";

const fixture = new CostTrackerProjectFixture();

function listURL(pageURL: string) {
  const url = new URL(pageURL);
  // Internal links render the active locale; compare the route, not the prefix.
  return `${url.pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?(?=\/)/, "")}${url.search}`;
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

  test("sorts tied Projects at priorities two to four and fits the viewport", async ({
    page,
  }) => {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, fixture.projectId));
    if (!project) throw new Error("Project fixture is missing");
    const prefix = `Sort regression ${randomUUID()}`;
    const rows = Array.from({ length: 8 }, (_, index) => ({
      id: randomUUID(),
      organizationId: project.organizationId,
      name: `${prefix} ${index % 2 ? "B" : "A"} ${"long project name ".repeat(12)}`,
      startDate: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 4))),
      endDate: new Date(Date.UTC(2026, 1, 1 + (Math.floor(index / 2) % 2))),
      location: "Berlin",
      country: "DE" as const,
    }));
    try {
      await db.insert(projectsTable).values([...rows].reverse());
      const sort = [
        { field: "settlement", direction: "asc" },
        { field: "startDate", direction: "desc" },
        { field: "endDate", direction: "desc" },
        { field: "name", direction: "asc" },
      ];
      await page.goto(
        `/projects?search=${encodeURIComponent(prefix)}&sort=${encodeURIComponent(JSON.stringify(sort))}`,
      );
      const visibleIds = () =>
        page
          .locator("tbody tr[data-project-id]")
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("data-project-id")),
          );
      const assertOrder = async (indices: number[]) =>
        expect.poll(visibleIds).toEqual(indices.map((index) => rows[index]!.id));
      await assertOrder([6, 7, 4, 5, 2, 3, 0, 1]);
      await page.getByTestId("sort-project-end").focus();
      await page.getByTestId("sort-project-end").press("Enter");
      await assertOrder([4, 5, 6, 7, 0, 1, 2, 3]);
      await page.getByTestId("sort-project-name").click();
      await assertOrder([5, 4, 7, 6, 1, 0, 3, 2]);
      await page.getByTestId("sort-project-start").click();
      await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);
      await page.reload();
      await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);

      for (const width of [1440, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByTestId("project-columns-menu")).toBeVisible();
        const geometry = await page.locator("table").evaluate((table) => {
          const container = table.parentElement!;
          const name = table.querySelector("tbody a")!;
          return {
            viewport: innerWidth,
            document: document.documentElement.scrollWidth,
            table: table.getBoundingClientRect().right,
            containerWidth: container.clientWidth,
            scrollWidth: container.scrollWidth,
            truncated: name.scrollWidth > name.clientWidth,
            overflow: getComputedStyle(name).textOverflow,
          };
        });
        expect(geometry.document).toBeLessThanOrEqual(width);
        expect(geometry.table).toBeLessThanOrEqual(width);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.containerWidth);
        expect(geometry.truncated).toBe(true);
        expect(geometry.overflow).toBe("ellipsis");
      }
    } finally {
      await db.delete(projectsTable).where(
        inArray(
          projectsTable.id,
          rows.map((row) => row.id),
        ),
      );
    }
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
      page.locator(`a[href$="/projects/${fixture.projectId}"]`),
    ).toBeVisible();
    // Red if nuqs no longer writes list state to the URL or bypasses /api/rpc.
    expect(rpcRequests.length).toBeGreaterThan(0);

    const filteredListURL = listURL(page.url());
    await page.reload();
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await expect(page.getByTestId("project-search")).toHaveValue(
      "Cost Tracker E2E",
    );
    await expect(
      page.locator(`a[href$="/projects/${fixture.projectId}"]`),
    ).toBeVisible();
    // Red if reloading loses the URL-backed state or its matching Project data.
    expect(listURL(page.url())).toBe(filteredListURL);

    await page.locator(`a[href$="/projects/${fixture.projectId}"]`).click();
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      fixture.projectId,
    );
    const detailURL = page.url();
    await page.getByTestId("back-to-projects").click();
    // The breadcrumb returns to the Projects table itself; list state is not
    // carried through the detail page (no `returnTo` contract any more).
    await expect(page).toHaveURL(/\/projects$/);

    // No list state is carried back: the table opens unfiltered.
    await expect(page.getByTestId("project-search")).toHaveValue("");

    await page.goBack();
    await expect(page).toHaveURL(detailURL);
    await expect(page.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      fixture.projectId,
    );
    await page.goForward();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    await expect(
      page.locator(`a[href$="/projects/${fixture.projectId}"]`),
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

    // Text-free hook: the assignment dialog carries a stable test id.
    await page.getByTestId("assign-organization").click();
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

    await page.goto(`/projects?search=${encodeURIComponent(fixture.name)}`);
    await expect(page.getByTestId("project-list")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    const advancedFilters = page.getByTestId("project-advanced-filters");
    await expect(page.getByTestId("project-partner-filter-menu")).toBeHidden();
    await advancedFilters.locator("summary").click();
    await expect(
      advancedFilters.getByTestId("project-partner-filter-menu"),
    ).toBeVisible();
    await expect(
      advancedFilters.getByTestId("project-partner-filter-menu"),
    ).toBeEnabled();
    await advancedFilters.getByTestId("project-partner-filter-menu").click();
    await page
      .getByTestId(`project-partner-filter-${fixture.partnerOrganizationId}`)
      .click();
    const otherPartner = page
      .locator(
        `[role="menuitemcheckbox"][data-testid^="project-partner-filter-"]:not([data-testid="project-partner-filter-${fixture.partnerOrganizationId}"])`,
      )
      .first();
    await expect(otherPartner).toBeVisible();
    const otherPartnerId = (await otherPartner.getAttribute(
      "data-testid",
    ))!.replace("project-partner-filter-", "");
    await otherPartner.click();
    await expect(otherPartner).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect
      .poll(() =>
        new URL(page.url()).searchParams.getAll("partnerOrganizationIds").sort(),
      )
      .toEqual([fixture.partnerOrganizationId, otherPartnerId].sort());
    await expect(
      page.getByTestId(`project-link-${fixture.projectId}`),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("project-list")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await expect(advancedFilters).toHaveAttribute("open", "");
    await expect(
      advancedFilters.getByTestId("project-partner-filter-menu"),
    ).toBeEnabled();
    await advancedFilters.getByTestId("project-partner-filter-menu").click();
    await expect(
      advancedFilters.getByTestId("project-partner-filter-menu"),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByTestId(`project-partner-filter-${fixture.partnerOrganizationId}`),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("project-partner-filter-reset").click();
    await expect
      .poll(() => new URL(page.url()).searchParams.has("partnerOrganizationIds"))
      .toBe(false);

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
