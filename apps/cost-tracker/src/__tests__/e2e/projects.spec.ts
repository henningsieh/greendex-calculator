import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
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

  test("shows the same status badge in the Project table, card header and details", async ({
    page,
  }) => {
    const [project] = await db
      .select({ name: projectsTable.name })
      .from(projectsTable)
      .where(eq(projectsTable.id, fixture.projectId));
    if (!project) throw new Error("Project fixture is missing");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/projects?search=${encodeURIComponent(project.name)}`);
    const badge = page
      .locator(`[data-project-id="${fixture.projectId}"] [data-status]`)
      .filter({ visible: true });
    await expect(badge).toBeVisible();
    const status = await badge.getAttribute("data-status");
    if (!status) throw new Error("Project fixture has no list status");
    const variant = await badge.getAttribute("data-variant");
    if (!variant) throw new Error("Project status has no badge variant");
    await page.setViewportSize({ width: 390, height: 900 });
    const card = page.locator(`div[data-project-id="${fixture.projectId}"]`);
    const title = card.getByTestId(`project-link-${fixture.projectId}-card`);
    const cardBadge = card.getByTestId("project-status");
    await expect(cardBadge).toBeVisible();
    await expect(cardBadge).toHaveAttribute("data-status", status);
    await expect(cardBadge).toHaveAttribute("data-variant", variant);
    const titleBox = await title.boundingBox();
    const badgeBox = await cardBadge.boundingBox();
    if (!titleBox || !badgeBox) throw new Error("Card header is not visible");
    expect(badgeBox.x).toBeGreaterThan(titleBox.x);
    expect(Math.abs(badgeBox.y - titleBox.y)).toBeLessThan(5);
    await expect(card.locator("dl [data-status]")).toHaveCount(0);
    await page.goto(`/projects/${fixture.projectId}`);
    const detailBadge = page.getByTestId("project-status");
    await expect(detailBadge).toHaveAttribute("data-status", status);
    await expect(detailBadge).toHaveAttribute("data-variant", variant);
  });

  test("filters by one Status facet, keeps the selection in the URL and opens an archived Project read-only", async ({
    page,
  }) => {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, fixture.projectId));
    if (!project) throw new Error("Project fixture is missing");
    const prefix = `Status facet ${randomUUID()}`;
    const archivedId = randomUUID();
    await db.insert(projectsTable).values({
      id: archivedId,
      organizationId: project.organizationId,
      name: `${prefix} Archived`,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-02T00:00:00.000Z"),
      location: "Berlin",
      country: "DE",
      costTrackerArchived: true,
    });
    try {
      await page.goto(`/projects?search=${encodeURIComponent(prefix)}`);
      await expect(page.getByTestId("project-list")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await expect(page.locator("[data-filtered-project-count]")).toHaveAttribute(
        "data-filtered-project-count",
        "0",
      );

      await page.getByTestId("project-status-filter").click();
      const archivedOption = page.getByTestId("project-status-archived");
      await expect(archivedOption).toHaveAttribute("aria-checked", "false");
      await archivedOption.click();
      await expect
        .poll(() => new URL(page.url()).searchParams.getAll("status"))
        .toEqual(["open", "ready", "archived"]);
      await expect(
        page
          .locator(`a[href$="/projects/${archivedId}"]`)
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(page.locator("[data-filtered-project-count]")).toHaveAttribute(
        "data-filtered-project-count",
        "1",
      );

      await page.getByTestId("project-status-all").click();
      await expect
        .poll(() => new URL(page.url()).searchParams.getAll("status"))
        .toEqual(["open", "ready", "archived"]);
      await page.reload();
      await expect(page.getByTestId("project-list")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await expect(
        page
          .locator(`a[href$="/projects/${archivedId}"]`)
          .filter({ visible: true }),
      ).toBeVisible();

      await page
        .locator(`a[href$="/projects/${archivedId}"]`)
        .filter({ visible: true })
        .click();
      await expect(page.getByTestId("project-workspace")).toHaveAttribute(
        "data-archived",
        "true",
      );
      await expect(
        page.getByTestId("project-workspace").getByTestId("project-status"),
      ).toHaveAttribute("data-status", "archived");
      // Read-only: an archived Project offers no partnership creation controls.
      await expect(page.getByTestId("partnership-actions-menu")).toHaveCount(0);
      await expect(page.getByTestId("assign-partnership-link")).toHaveCount(0);
    } finally {
      await db.delete(projectsTable).where(eq(projectsTable.id, archivedId));
    }
  });

  test("sorts tied Projects and keeps them usable across viewport sizes", async ({
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
      name: `${prefix} ${index % 2 ? "B" : "A"} ${"W".repeat(100)}`,
      startDate: new Date(Date.UTC(2026, 0, 1 + Math.floor(index / 4))),
      endDate: new Date(Date.UTC(2026, 1, 1 + (Math.floor(index / 2) % 2))),
      location: "Berlin",
      country: "DE" as const,
    }));
    try {
      await db.insert(projectsTable).values([...rows].reverse());
      const sort = [
        { field: "status", direction: "asc" },
        { field: "startDate", direction: "desc" },
        { field: "endDate", direction: "desc" },
        { field: "name", direction: "asc" },
        // Every fixture row shares this country, so it only exercises the
        // fifth criterion slot without changing the expected order.
        { field: "country", direction: "asc" },
      ];
      let releaseScripts = () => {};
      const scriptsReleased = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() === "script") {
          await scriptsReleased;
        }
        await route.continue();
      });
      const sortControls = [
        page.getByTestId("sort-project-name"),
        page.getByTestId("sort-project-status"),
        page.getByTestId("sort-project-start"),
        page.getByTestId("sort-project-end"),
        page.getByTestId("project-sort-menu"),
      ];
      try {
        await page.goto(
          `/projects?search=${encodeURIComponent(prefix)}&sort=${encodeURIComponent(JSON.stringify(sort))}`,
          { waitUntil: "commit" },
        );
        for (const control of sortControls) {
          await expect(control).toBeVisible();
          await expect(control).toBeDisabled();
        }
      } finally {
        releaseScripts();
        await page.unrouteAll({ behavior: "wait" });
      }
      for (const control of sortControls) {
        await expect(control).toBeEnabled();
      }
      const visibleIds = () =>
        page
          .locator("[data-project-id]")
          .filter({ visible: true })
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute("data-project-id")),
          );
      const assertOrder = async (indices: number[]) =>
        expect.poll(visibleIds).toEqual(indices.map((index) => rows[index]!.id));
      await assertOrder([6, 7, 4, 5, 2, 3, 0, 1]);
      await page.getByTestId("sort-project-end").focus();
      await page.getByTestId("sort-project-end").press("Enter");
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("sort") ===
          JSON.stringify([
            { field: "status", direction: "asc" },
            { field: "startDate", direction: "desc" },
            { field: "endDate", direction: "asc" },
            { field: "name", direction: "asc" },
            { field: "country", direction: "asc" },
          ]),
      );
      await assertOrder([4, 5, 6, 7, 0, 1, 2, 3]);
      await page.getByTestId("sort-project-name").click();
      await assertOrder([5, 4, 7, 6, 1, 0, 3, 2]);
      await page.getByTestId("sort-project-start").click();
      await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);
      await page.reload();
      await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);
      await expect(page.getByTestId("project-sort-menu")).toBeEnabled();
      await page.getByTestId("project-sort-menu").click();
      for (const field of ["status", "startDate", "endDate", "name", "country"]) {
        await expect(
          page.getByTestId(`project-sort-direction-${field}`),
        ).toBeEnabled();
        await expect(
          page.getByTestId(`project-sort-remove-${field}`),
        ).toBeEnabled();
      }
      await expect(page.getByTestId("project-sort-up-status")).toBeDisabled();
      await expect(page.getByTestId("project-sort-down-country")).toBeDisabled();
      // Five sortable fields are all in use, so no further rule can be added.
      await expect(page.getByTestId("project-sort-add")).toBeDisabled();
      await expect(page.getByTestId("project-sort-reset")).toBeEnabled();
      await page.keyboard.press("Escape");

      const sortedListURL = page.url();
      for (const width of [1440, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(page.getByTestId("project-columns-menu")).toBeVisible();
        await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            ),
          )
          .toBeLessThanOrEqual(1);
        await page
          .locator(`a[href$="/projects/${rows[1]!.id}"]`)
          .filter({ visible: true })
          .click();
        await expect(page.getByTestId("project-workspace")).toHaveAttribute(
          "data-project-id",
          rows[1]!.id,
        );
        await page.goto(sortedListURL);
        await assertOrder([1, 0, 3, 2, 5, 4, 7, 6]);
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

  test("prefetches Partner options on filtered and cursor deep links", async ({
    page,
  }) => {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, fixture.projectId));
    if (!project) throw new Error("Project fixture is missing");
    const prefix = `Prefetch ${randomUUID()}`;
    const rows = Array.from({ length: 26 }, (_, index) => ({
      id: randomUUID(),
      organizationId: project.organizationId,
      name: `${prefix} ${String(index).padStart(2, "0")}`,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-02T00:00:00.000Z"),
      location: "Berlin",
      country: "DE" as const,
    }));
    const requests: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/api/rpc/projects/listHosted") requests.push(path);
    });
    try {
      await db.insert(projectsTable).values(rows);
      await db.insert(projectPartnerOrganizationsTable).values(
        rows.map((row) => ({
          id: randomUUID(),
          projectId: row.id,
          organizationId: fixture.partnerOrganizationId,
        })),
      );
      await page.goto(
        `/projects?scope=hosted&search=${encodeURIComponent(prefix)}&partnerOrganizationIds=${fixture.partnerOrganizationId}`,
      );
      await expect(page.locator("tbody tr[data-project-id]")).toHaveCount(25);
      await expect(page.getByTestId("project-partner-filter-menu")).toBeEnabled();
      expect(requests).toEqual([]);
      await page.getByTestId("next-project-page").click();
      await expect(page.locator("tbody tr[data-project-id]")).toHaveCount(1);
      await expect(page).toHaveURL((url) => url.searchParams.has("cursor"));
      requests.length = 0;
      await page.reload();
      await expect(page.locator("tbody tr[data-project-id]")).toHaveCount(1);
      await expect(page.getByTestId("project-partner-filter-menu")).toBeEnabled();
      expect(requests).toEqual([]);
    } finally {
      await db.delete(projectsTable).where(
        inArray(
          projectsTable.id,
          rows.map(({ id }) => id),
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
      page
        .locator(`a[href$="/projects/${fixture.projectId}"]`)
        .filter({ visible: true }),
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
      page
        .locator(`a[href$="/projects/${fixture.projectId}"]`)
        .filter({ visible: true }),
    ).toBeVisible();
    // Red if reloading loses the URL-backed state or its matching Project data.
    expect(listURL(page.url())).toBe(filteredListURL);

    await page
      .locator(`a[href$="/projects/${fixture.projectId}"]`)
      .filter({ visible: true })
      .click();
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
      page
        .locator(`a[href$="/projects/${fixture.projectId}"]`)
        .filter({ visible: true }),
    ).toBeVisible();
  });

  test("filters from the first character and keeps focus, caret and draft through result refreshes", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    const projectLink = page
      .locator(`a[href$="/projects/${fixture.projectId}"]`)
      .filter({ visible: true });
    const search = page.getByTestId("project-search");
    await search.click();

    // A single character reaches the server; no two-/three-character gate.
    const oneCharacterRequest = page.waitForRequest(
      (request) =>
        isRPCRequest(request.url()) &&
        (request.postData() ?? "").includes('"search":"q"'),
    );
    await page.keyboard.type("q");
    await oneCharacterRequest;
    await expect(projectLink).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    const distinctive = fixture.name.slice(-8);
    for (const [index, character] of [...distinctive].entries()) {
      await page.keyboard.type(character);
      const typed = distinctive.slice(0, index + 1);
      // The debounce is observable through the URL; no fixed sleep needed.
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("search") === typed,
      );
      expect(
        await search.evaluate((element: HTMLInputElement) => ({
          focused: document.activeElement === element,
          selectionEnd: element.selectionEnd,
          selectionStart: element.selectionStart,
          value: element.value,
        })),
      ).toEqual({
        focused: true,
        selectionEnd: index + 1,
        selectionStart: index + 1,
        value: typed,
      });
    }
    await expect(projectLink).toBeVisible();

    // Edit inside the term: focus and the caret survive the result refresh.
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const edited = `${distinctive.slice(0, 2)}X${distinctive.slice(2)}`;
    await page.keyboard.type("X");
    // Wait for the settled list the edit produces, not only for the request:
    // the fixture no longer matches the edited term, so its disappearance is
    // the render that the caret must survive.
    await expect(projectLink).toHaveCount(0);
    expect(
      await search.evaluate((element: HTMLInputElement) => ({
        focused: document.activeElement === element,
        selectionStart: element.selectionStart,
        value: element.value,
      })),
    ).toEqual({ focused: true, selectionStart: 3, value: edited });
    // The URL keeps the typed case; the query layer lowercases for matching.
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("search") === edited,
    );
    // The caret survives the refresh that the mid-string edit triggered.
    expect(
      await search.evaluate((element: HTMLInputElement) => ({
        focused: document.activeElement === element,
        selectionStart: element.selectionStart,
        value: element.value,
      })),
    ).toEqual({ focused: true, selectionStart: 3, value: edited });
  });

  test("keeps a cleared search cleared when a debounce is pending", async ({
    page,
  }) => {
    await page.goto(`/projects?search=${encodeURIComponent("unmatched-425")}`);
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    const search = page.getByTestId("project-search");
    await search.click();
    await page.keyboard.type("x");

    await page
      .getByTestId("project-clear-filters")
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("search"));
    // Negative observation window: the stale write would land after the
    // 300 ms debounce, so wait past it before asserting the URL stayed clear.
    await page.waitForTimeout(800);

    await expect(page).toHaveURL((url) => !url.searchParams.has("search"));
    await expect(search).toHaveValue("");
    await expect(
      page
        .locator(`a[href$="/projects/${fixture.projectId}"]`)
        .filter({ visible: true }),
    ).toBeVisible();
  });

  test("cancels a pending search when clearing filters whose URL search is already empty", async ({
    page,
  }) => {
    // The date filter alone empties the register, so Clear filters runs while
    // the URL search is already "". The pending draft must still be dropped.
    await page.goto("/projects?dateFrom=2099-01-01");
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    const search = page.getByTestId("project-search");
    await search.click();
    await page.keyboard.type("x");

    await page
      .getByTestId("project-clear-filters")
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        !url.searchParams.has("search") && !url.searchParams.has("dateFrom"),
    );
    await page.waitForTimeout(800);

    await expect(page).toHaveURL(
      (url) =>
        !url.searchParams.has("search") && !url.searchParams.has("dateFrom"),
    );
    await expect(search).toHaveValue("");
  });

  test("keeps browser history navigation ahead of a pending search", async ({
    page,
  }) => {
    await page.goto("/projects");
    await expect(
      page.locator('[aria-label="Project list"][data-hydrated="true"]'),
    ).toBeVisible();
    const search = page.getByTestId("project-search");
    await search.click();
    // Commit one search so its pushState creates a same-document history entry.
    await page.keyboard.type("unmatched-425");
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("search") === "unmatched-425",
    );

    // A pending edit must not survive the popstate.
    await page.keyboard.type("x");
    await page.goBack();
    await expect(page).toHaveURL((url) => !url.searchParams.has("search"));
    await page.waitForTimeout(800);

    await expect(page).toHaveURL((url) => !url.searchParams.has("search"));
    await expect(search).toHaveValue("");
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

    // Text-free hook: the assignment dialog lives in the actions overflow
    // menu and carries a stable test id.
    await page.getByTestId("partnership-actions-menu").click();
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
      page
        .locator(`a[href$="/projects/${fixture.projectId}"]`)
        .filter({ visible: true }),
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

test("opens Organization settings and Team separately from the sidebar", async ({
  page,
}) => {
  await page.goto("/projects");
  await expect(page.getByTestId("project-list")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.getByTestId("sidebar-nav-organization").click();
  await expect(page).toHaveURL(/\/organization$/);
  const pageSection = page.locator("main [data-navigation-section]:visible");
  await expect(pageSection).toHaveAttribute(
    "data-navigation-section",
    "organization",
  );
  await expect(page.getByTestId("organization-country")).toBeVisible();
  await expect(
    page.getByTestId("staff-members").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByTestId("staff-invite").filter({ visible: true }),
  ).toHaveCount(0);

  await page.getByTestId("sidebar-nav-team").click();
  await expect(page).toHaveURL(/\/organization\/team$/);
  await expect(pageSection).toHaveAttribute(
    "data-navigation-section",
    "organization",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("staff-members")).toBeVisible();
  await expect(page.getByTestId("staff-invite")).toBeVisible();
  await expect(
    page.getByTestId("organization-country").filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('nav[data-slot="breadcrumb"] a').filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator('nav[data-slot="breadcrumb"] [aria-current="page"]')
      .filter({ visible: true }),
  ).toBeVisible();

  const account = page
    .getByTestId("account-menu-trigger")
    .filter({ visible: true })
    .first();
  await account.click();
  await page.locator('[role="menuitem"][href$="/user-settings"]').click();
  await expect(page).toHaveURL(/\/user-settings$/);
  await expect(
    page.locator("main [data-navigation-section]:visible"),
  ).toHaveAttribute("data-navigation-section", "account");
  await expect(
    page
      .locator('nav[data-slot="breadcrumb"] [aria-current="page"]')
      .filter({ visible: true }),
  ).toBeVisible();
});
