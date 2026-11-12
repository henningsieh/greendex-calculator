import { describe, expect, it } from "vitest";

import {
  SearchMembersInputSchema,
  OrganizationStatsInputSchema,
} from "@/features/organizations/validation-schemas";

describe("organization procedure inputs", () => {
  it("requires a raw organization ID and strips unknown keys", () => {
    expect(
      OrganizationStatsInputSchema.parse({ organizationId: "", extra: 1 }),
    ).toEqual({ organizationId: "" });
    expect(
      OrganizationStatsInputSchema.safeParse({}).error?.issues.map(
        ({ path, message }) => ({ path, message }),
      ),
    ).toEqual([
      {
        path: ["organizationId"],
        message: "Invalid input: expected string, received undefined",
      },
    ]);
    expect(
      OrganizationStatsInputSchema.safeParse({ organizationId: null }).success,
    ).toBe(false);
  });
  it("keeps filters optional and accepts unconstrained numbers", () => {
    expect(SearchMembersInputSchema.parse({ organizationId: "" })).toEqual({
      organizationId: "",
    });
    expect(
      SearchMembersInputSchema.parse({
        organizationId: "x",
        filters: {
          roles: ["owner", "admin", "coordinator", "participant"],
          search: "",
          sortBy: "user.email",
          sortDirection: "desc",
          limit: -1.5,
          offset: 0.5,
          extra: true,
        },
        extra: true,
      }),
    ).toEqual({
      organizationId: "x",
      filters: {
        roles: ["owner", "admin", "coordinator", "participant"],
        search: "",
        sortBy: "user.email",
        sortDirection: "desc",
        limit: -1.5,
        offset: 0.5,
      },
    });
    expect(
      SearchMembersInputSchema.parse({ organizationId: "x", filters: {} }),
    ).toEqual({ organizationId: "x", filters: {} });
    expect(
      SearchMembersInputSchema.safeParse({ organizationId: "x", filters: null })
        .error?.issues[0]?.path,
    ).toEqual(["filters"]);
  });
  it("rejects invalid nested enums with their original paths and messages", () => {
    const issues = SearchMembersInputSchema.safeParse({
      organizationId: "x",
      filters: { roles: ["invalid"], sortBy: "email", sortDirection: "up" },
    }).error?.issues;
    expect(issues?.map(({ path, message }) => ({ path, message }))).toEqual([
      {
        path: ["filters", "roles", 0],
        message:
          'Invalid option: expected one of "owner"|"admin"|"coordinator"|"participant"',
      },
      {
        path: ["filters", "sortBy"],
        message:
          'Invalid option: expected one of "createdAt"|"role"|"user.name"|"user.email"',
      },
      {
        path: ["filters", "sortDirection"],
        message: 'Invalid option: expected one of "asc"|"desc"',
      },
    ]);
  });
});
