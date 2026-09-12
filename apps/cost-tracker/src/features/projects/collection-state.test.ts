import { describe, expect, it } from "vitest";

import {
  getProjectCollectionReturnDestination,
  loadProjectCollectionSearchParams,
  normalizeProjectCollectionState,
} from "@/features/projects/collection-state";

describe("Project collection URL state", () => {
  it("parses typed defaults without adding URL-only state", () => {
    expect(loadProjectCollectionSearchParams({})).toEqual({
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
      normalizeProjectCollectionState({
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

  it("accepts a local Project collection return destination", () => {
    expect(
      getProjectCollectionReturnDestination(
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
    expect(getProjectCollectionReturnDestination(returnTo)).toBe("/projects");
  });

  it("omits search values shorter than three normalized characters", () => {
    const state = normalizeProjectCollectionState({
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
