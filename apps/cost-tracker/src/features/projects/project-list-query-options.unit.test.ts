import { describe, expect, it } from "vitest";

import {
  getProjectListReturnDestination,
  loadProjectListSearchParams,
  normalizeProjectListState,
  resolveProjectListState,
} from "@/features/projects/project-list-query-options";

describe("Project list URL state", () => {
  it("parses typed defaults without adding URL-only state", () => {
    expect(loadProjectListSearchParams({})).toEqual({
      scope: null,
      search: "",
      window: "all",
      dateFrom: null,
      dateTo: null,
      partnerOrganizationIds: [],
      sort: "operational",
      cursor: "",
      pageSize: 25,
    });
  });

  it("normalizes search, Partner filters, and invalid date ranges safely", () => {
    expect(
      normalizeProjectListState({
        scope: "hosted",
        search: "  CLIMATE  ",
        window: "open",
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
      window: "open",
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
        window: "all",
        partnerOrganizationIds: [],
        sort: "operational",
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
        window: "all",
        partnerOrganizationIds: [],
        sort: "operational",
        cursor: undefined,
        pageSize: 25,
      },
      didPartnerToHostedFallback: false,
    });
  });

  it("accepts a local Project list return destination", () => {
    expect(
      getProjectListReturnDestination(
        "/projects?scope=partner&search=climate&cursor=opaque",
      ),
    ).toBe("/projects?scope=partner&search=climate&cursor=opaque");
  });

  it.each([
    undefined,
    ["/projects"],
    "projects?scope=hosted",
    "/projects/project-1",
    "//attacker.example/projects",
    "https://attacker.example/projects",
  ])("falls back for an unsafe Project return destination: %j", (returnTo) => {
    expect(getProjectListReturnDestination(returnTo)).toBe("/projects");
  });

  it("omits search values shorter than three normalized characters", () => {
    const state = normalizeProjectListState({
      scope: null,
      search: " ab ",
      window: "all",
      dateFrom: null,
      dateTo: null,
      partnerOrganizationIds: [],
      sort: "operational",
      cursor: "",
      pageSize: 25,
    });

    expect(state.search).toBeUndefined();
    expect(state.cursor).toBeUndefined();
  });
});
