import { describe, expect, it } from "vitest";

import {
  getProjectListQueryOptions,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/list-query-options";

describe("Project list URL state", () => {
  it("parses typed defaults without adding URL-only state", () => {
    expect(loadProjectListSearchParams({})).toEqual({
      scope: null,
      search: "",
      dateFrom: null,
      dateTo: null,
      archive: "active",
      settlement: "all",
      partnerOrganizationIds: [],
      sort: "start-asc",
      cursor: "",
      pageSize: 25,
    });
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
      archive: "active",
      settlement: "all",
      partnerOrganizationIds: [],
      sort: "start-asc",
      cursor: "",
      pageSize: 25,
    });
  });

  it("normalizes search, Partner filters, and invalid date ranges safely", () => {
    expect(
      normalizeProjectListState({
        scope: "hosted",
        search: "  CLIMATE  ",
        dateFrom: new Date("2026-06-30T00:00:00.000Z"),
        dateTo: new Date("2026-06-01T00:00:00.000Z"),
        archive: "archived",
        settlement: "ready",
        partnerOrganizationIds: ["partner-2", "", "partner-1", "partner-2"],
        sort: "start-desc",
        cursor: "opaque",
        pageSize: 50,
      }),
    ).toEqual({
      scope: "hosted",
      search: "climate",
      dateFrom: undefined,
      dateTo: undefined,
      archive: "archived",
      settlement: "ready",
      partnerOrganizationIds: ["partner-1", "partner-2"],
      sort: "start-desc",
      cursor: "opaque",
      pageSize: 50,
    });
  });

  it("represents an Organization with no available Project scope", () => {
    const resolution = resolveProjectListState(
      {
        scope: "partner",
        search: undefined,
        partnerOrganizationIds: [],
        archive: "active",
        settlement: "all",
        sort: "start-asc",
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
        archive: "active",
        settlement: "all",
        sort: "start-asc",
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
      archive: "archived" as const,
      settlement: "ready" as const,
      partnerOrganizationIds: ["partner-1"],
      sort: "start-desc" as const,
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
          archive: "archived",
          settlement: "ready",
          partnerOrganizationIds: ["partner-1"],
          sort: "start-desc",
          cursor: "opaque",
          pageSize: 50,
        },
      },
    ]);
    expect(getProjectListQueryOptions("partner", state).queryKey).toEqual([
      ["projects", "listPartner"],
      {
        type: "query",
        input: {
          search: "climate",
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          archive: "archived",
          settlement: "ready",
          sort: "start-desc",
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
      archive: "active",
      settlement: "all",
      partnerOrganizationIds: [],
      sort: "start-asc",
      cursor: "",
      pageSize: 25,
    });

    expect(state.search).toBeUndefined();
    expect(state.cursor).toBeUndefined();
  });
});
