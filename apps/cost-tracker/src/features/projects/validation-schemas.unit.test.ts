import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { describe, expect, it } from "vitest";

import {
  HostedProjectListInputSchema,
  PartnerProjectListInputSchema,
  ProjectCreateInputSchema,
  ProjectDetailInputSchema,
} from "@/features/projects/validation-schemas";

const country = EU_COUNTRY_CODES[0];

function validCreateInput() {
  return {
    name: "Harbour Knowledge Exchange",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    location: "Gdansk",
    country,
  };
}

describe("Project creation input", () => {
  it("accepts a complete Project and trims text fields", () => {
    expect(
      ProjectCreateInputSchema.parse({
        ...validCreateInput(),
        name: "  Harbour Knowledge Exchange  ",
        location: "  Gdansk  ",
      }),
    ).toEqual({
      ...validCreateInput(),
    });
  });

  it("rejects blank names and locations", () => {
    expect(
      ProjectCreateInputSchema.safeParse({
        ...validCreateInput(),
        name: "   ",
      }).success,
    ).toBe(false);
    expect(
      ProjectCreateInputSchema.safeParse({
        ...validCreateInput(),
        location: "",
      }).success,
    ).toBe(false);
  });

  it("rejects an end date that precedes the start date on the endDate path", () => {
    const result = ProjectCreateInputSchema.safeParse({
      ...validCreateInput(),
      startDate: new Date("2026-12-31"),
      endDate: new Date("2026-01-01"),
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("rejects unknown keys and non-EU countries", () => {
    expect(
      ProjectCreateInputSchema.safeParse({
        ...validCreateInput(),
        extra: "not-a-field",
      }).success,
    ).toBe(false);
    expect(
      ProjectCreateInputSchema.safeParse({
        ...validCreateInput(),
        country: "XX",
      }).success,
    ).toBe(false);
  });
});

describe("Project list input", () => {
  it("applies list defaults without requiring optional filters", () => {
    expect(PartnerProjectListInputSchema.parse({ pageSize: 25 })).toEqual({
      window: "all",
      sort: "operational",
      pageSize: 25,
    });
  });

  it("normalizes search to trimmed lowercase and enforces length", () => {
    expect(
      PartnerProjectListInputSchema.parse({
        pageSize: 25,
        search: "  SOLAR  ",
      }).search,
    ).toBe("solar");
    expect(
      PartnerProjectListInputSchema.safeParse({ pageSize: 25, search: "ab" })
        .success,
    ).toBe(false);
  });

  it("rejects an inverted date range and unsupported page sizes", () => {
    expect(
      PartnerProjectListInputSchema.safeParse({
        pageSize: 25,
        dateFrom: new Date("2026-12-31"),
        dateTo: new Date("2026-01-01"),
      }).success,
    ).toBe(false);
    expect(
      PartnerProjectListInputSchema.safeParse({ pageSize: 30 }).success,
    ).toBe(false);
  });

  it("defaults hosted partner filters and dedupes them sorted", () => {
    expect(
      HostedProjectListInputSchema.parse({ pageSize: 50 }).partnerOrganizationIds,
    ).toEqual([]);
    expect(
      HostedProjectListInputSchema.parse({
        pageSize: 50,
        partnerOrganizationIds: ["org-b", "org-a", "org-b"],
      }).partnerOrganizationIds,
    ).toEqual(["org-a", "org-b"]);
  });
});

describe("Project detail input", () => {
  it("trims the Project identity", () => {
    expect(
      ProjectDetailInputSchema.parse({ projectId: "  project-id  " }),
    ).toEqual({ projectId: "project-id" });
  });

  it("rejects blank and overlong identities", () => {
    expect(ProjectDetailInputSchema.safeParse({ projectId: "" }).success).toBe(
      false,
    );
    expect(
      ProjectDetailInputSchema.safeParse({ projectId: "a".repeat(129) }).success,
    ).toBe(false);
  });
});
