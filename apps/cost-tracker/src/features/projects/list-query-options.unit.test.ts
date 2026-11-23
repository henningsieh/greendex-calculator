import { describe, expect, it } from "vitest";

import {
  getProjectListQueryOptions,
  getProjectPartnerFilterQueryOptions,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/list-query-options";

const encodeCursor = (payload: unknown) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

describe("Project list URL state", () => {
  it("keeps current and opaque cursors and drops an obsolete format", () => {
    const current = encodeCursor({ version: 5, id: "project-1" });
    const stale = encodeCursor({ version: 4, id: "project-1" });
    const opaque = "not-a-cursor";

    expect(
      normalizeProjectListState(loadProjectListSearchParams({ cursor: current }))
        .cursor,
    ).toBe(current);
    expect(
      normalizeProjectListState(loadProjectListSearchParams({ cursor: stale }))
        .cursor,
    ).toBeUndefined();
    // Opaque cursors are the procedure's business, not the URL layer's.
    expect(
      normalizeProjectListState(loadProjectListSearchParams({ cursor: opaque }))
        .cursor,
    ).toBe(opaque);
  });

  it("restores an ordered sort from a shared URL", () => {
    const order = [
      { field: "name", direction: "desc" },
      { field: "endDate", direction: "asc" },
    ];
    const state = loadProjectListSearchParams({ sort: JSON.stringify(order) });
    expect(normalizeProjectListState(state).sort).toEqual(order);
    expect(
      loadProjectListSearchParams({ sort: JSON.stringify([order[0], order[0]]) })
        .sort,
    ).toEqual([
      { field: "status", direction: "asc" },
      { field: "startDate", direction: "asc" },
    ]);
  });
  it("parses typed defaults without adding URL-only state", () => {
    expect(loadProjectListSearchParams({})).toEqual({
      scope: null,
      search: "",
      dateFrom: null,
      dateTo: null,
      status: ["open", "ready"],
      partnerOrganizationIds: [],
      sort: [
        { field: "status", direction: "asc" },
        { field: "startDate", direction: "asc" },
      ],
      cursor: "",
      pageSize: 25,
    });
  });

  it("parses a repeated Status parameter in canonical tuple order", () => {
    expect(
      normalizeProjectListState(
        loadProjectListSearchParams({
          status: ["archived", "open", "ready"],
        }),
      ).status,
    ).toEqual(["open", "ready", "archived"]);
    expect(
      normalizeProjectListState(
        loadProjectListSearchParams({ status: "archived" }),
      ).status,
    ).toEqual(["archived"]);
  });

  it("keeps an explicit empty Status as no constraint and defaults unknown values", () => {
    expect(
      normalizeProjectListState(loadProjectListSearchParams({ status: "" }))
        .status,
    ).toEqual([]);
    expect(
      normalizeProjectListState(loadProjectListSearchParams({ status: "bogus" }))
        .status,
    ).toEqual(["open", "ready"]);
  });

  it("ignores the removed window filter and falls back from the old sort", () => {
    expect(
      loadProjectListSearchParams({
        scope: "partner",
        window: "open",
        sort: "operational",
      }),
    ).toEqual({
      scope: "partner",
      search: "",
      dateFrom: null,
      dateTo: null,
      status: ["open", "ready"],
      partnerOrganizationIds: [],
      sort: [
        { field: "status", direction: "asc" },
        { field: "startDate", direction: "asc" },
      ],
      cursor: "",
      pageSize: 25,
    });
  });

  it("normalizes search, Partner filters, and invalid date ranges safely", () => {
    const cursor = encodeCursor({ version: 5, id: "project-1" });
    expect(
      normalizeProjectListState({
        scope: "hosted",
        search: "  CLIMATE  ",
        dateFrom: new Date("2026-06-30T00:00:00.000Z"),
        dateTo: new Date("2026-06-01T00:00:00.000Z"),
        status: ["archived", "ready"],
        partnerOrganizationIds: ["partner-2", "", "partner-1", "partner-2"],
        sort: [{ field: "startDate", direction: "desc" }],
        cursor,
        pageSize: 50,
      }),
    ).toEqual({
      scope: "hosted",
      search: "climate",
      dateFrom: undefined,
      dateTo: undefined,
      status: ["ready", "archived"],
      partnerOrganizationIds: ["partner-1", "partner-2"],
      sort: [{ field: "startDate", direction: "desc" }],
      cursor,
      pageSize: 50,
    });
  });

  it("represents an Organization with no available Project scope", () => {
    const resolution = resolveProjectListState(
      {
        scope: "partner",
        search: undefined,
        partnerOrganizationIds: [],
        status: ["open", "ready"],
        sort: [{ field: "startDate", direction: "asc" }],
        cursor: "stale-partner-cursor",
        pageSize: 25,
      },
      { hosted: false, partner: false },
    );

    expect(resolution).toEqual({
      scope: null,
      state: {
        scope: null,
        search: undefined,
        partnerOrganizationIds: [],
        status: ["open", "ready"],
        sort: [{ field: "startDate", direction: "asc" }],
        cursor: undefined,
        pageSize: 25,
      },
      didPartnerToHostedFallback: false,
    });
  });

  it("includes scope-specific procedure inputs in generated query keys", () => {
    const state = {
      scope: "hosted" as const,
      search: "climate",
      dateFrom: new Date("2026-01-01T00:00:00.000Z"),
      dateTo: new Date("2026-12-31T00:00:00.000Z"),
      status: ["ready", "archived"] as ("open" | "ready" | "archived")[],
      partnerOrganizationIds: ["partner-1"],
      sort: [{ field: "startDate" as const, direction: "desc" as const }],
      cursor: "opaque",
      pageSize: 50 as const,
    };

    expect(getProjectListQueryOptions("hosted", state).queryKey).toEqual([
      ["projects", "listHosted"],
      {
        type: "query",
        input: {
          search: "climate",
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          status: ["ready", "archived"],
          partnerOrganizationIds: ["partner-1"],
          sort: [{ field: "startDate", direction: "desc" }],
          cursor: "opaque",
          pageSize: 50,
        },
      },
    ]);
    expect(getProjectPartnerFilterQueryOptions(state).queryKey).toEqual(
      getProjectListQueryOptions("hosted", {
        ...state,
        partnerOrganizationIds: [],
        cursor: undefined,
      }).queryKey,
    );
    expect(getProjectListQueryOptions("partner", state).queryKey).toEqual([
      ["projects", "listPartner"],
      {
        type: "query",
        input: {
          search: "climate",
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          status: ["ready", "archived"],
          sort: [{ field: "startDate", direction: "desc" }],
          cursor: "opaque",
          pageSize: 50,
        },
      },
    ]);
  });

  it("omits search values shorter than three normalized characters", () => {
    const state = normalizeProjectListState({
      scope: null,
      search: " ab ",
      dateFrom: null,
      dateTo: null,
      status: ["open", "ready"],
      partnerOrganizationIds: [],
      sort: [{ field: "startDate", direction: "asc" }],
      cursor: "",
      pageSize: 25,
    });

    expect(state.search).toBeUndefined();
    expect(state.cursor).toBeUndefined();
  });
});
