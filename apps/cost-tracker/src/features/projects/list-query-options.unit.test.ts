import { describe, expect, it } from "vitest";

import {
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
        sort: "start-asc",
        cursor: undefined,
        pageSize: 25,
      },
      didPartnerToHostedFallback: false,
    });
  });

  it("omits search values shorter than three normalized characters", () => {
    const state = normalizeProjectListState({
      scope: null,
      search: " ab ",
      dateFrom: null,
      dateTo: null,
      partnerOrganizationIds: [],
      sort: "start-asc",
      cursor: "",
      pageSize: 25,
    });

    expect(state.search).toBeUndefined();
    expect(state.cursor).toBeUndefined();
  });
});
