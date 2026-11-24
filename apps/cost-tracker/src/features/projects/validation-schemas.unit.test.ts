import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { describe, expect, it } from "vitest";

import {
  HostedProjectListInputSchema,
  HostedProjectListSchema,
  ProjectDetailSchema,
  PartnerProjectListInputSchema,
  ProjectCreateInputSchema,
  ProjectDetailInputSchema,
  ProjectSortOrderSchema,
  createProjectCreateInputSchema,
} from "@/features/projects/validation-schemas";

const country = EU_COUNTRY_CODES[0];

describe("Project sort order", () => {
  it("preserves priority and rejects duplicate or unsupported fields", () => {
    const order = [
      { field: "name", direction: "desc" },
      { field: "startDate", direction: "asc" },
    ];
    expect(ProjectSortOrderSchema.parse(order)).toEqual(order);
    expect(ProjectSortOrderSchema.safeParse([...order, order[0]]).success).toBe(
      false,
    );
    expect(
      ProjectSortOrderSchema.safeParse([{ field: "actions", direction: "asc" }])
        .success,
    ).toBe(false);
    expect(
      ProjectSortOrderSchema.safeParse([{ field: "name", direction: "sideways" }])
        .success,
    ).toBe(false);
    expect(ProjectSortOrderSchema.safeParse([]).success).toBe(false);
  });
});

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

  it("injects supplied copy into field errors", () => {
    const schema = createProjectCreateInputSchema({
      nameRequired: "name-required",
      locationRequired: "location-required",
      countryRequired: "country-required",
      startDateRequired: "start-required",
      endDateRequired: "end-required",
      endBeforeStart: "end-before-start",
      tooLong: (maxLength) => `too-long-${maxLength}`,
    });
    const result = schema.safeParse({
      ...validCreateInput(),
      name: " ",
      location: " ",
      startDate: new Date("2026-12-31"),
      endDate: new Date("2026-01-01"),
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages).toContain("name-required");
    expect(messages).toContain("location-required");
    expect(messages).toContain("end-before-start");
  });
});

describe("Project list input", () => {
  it("applies list defaults without requiring optional filters", () => {
    expect(PartnerProjectListInputSchema.parse({ pageSize: 25 })).toEqual({
      sort: [
        { field: "status", direction: "asc" },
        { field: "startDate", direction: "asc" },
      ],
      status: ["open", "ready", "archived"],
      pageSize: 25,
    });
  });

  it("normalizes the Status selection into tuple order and deduplicates it", () => {
    expect(
      PartnerProjectListInputSchema.parse({
        pageSize: 25,
        status: ["archived", "open", "ready", "open"],
      }).status,
    ).toEqual(["open", "ready", "archived"]);
  });

  it("rejects unknown Status values and canonicalizes an empty selection", () => {
    expect(
      PartnerProjectListInputSchema.safeParse({
        pageSize: 25,
        status: ["bogus"],
      }).success,
    ).toBe(false);
    expect(
      PartnerProjectListInputSchema.parse({ pageSize: 25, status: [] }).status,
    ).toEqual(["open", "ready", "archived"]);
  });

  it("normalizes search to trimmed lowercase from the first character", () => {
    expect(
      PartnerProjectListInputSchema.parse({
        pageSize: 25,
        search: "  SOLAR  ",
      }).search,
    ).toBe("solar");
    expect(
      PartnerProjectListInputSchema.parse({ pageSize: 25, search: " A " }).search,
    ).toBe("a");
    expect(
      PartnerProjectListInputSchema.parse({ pageSize: 25, search: "ab" }).search,
    ).toBe("ab");
    expect(
      PartnerProjectListInputSchema.safeParse({
        pageSize: 25,
        search: "x".repeat(121),
      }).success,
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

describe("Project outputs", () => {
  it.each(["  id  ", "", "   ", "a".repeat(129)])(
    "preserves organization and partnership identifiers %s",
    (id) => {
      const metrics = {
        projectCount: 0,
        partnerOrganizationCount: 0,
      };
      expect(
        HostedProjectListSchema.parse({
          scope: "hosted",
          rows: [],
          metrics: { whole: metrics, filtered: metrics },
          partnerOptions: [{ id, name: "Partner" }],
        }).partnerOptions,
      ).toEqual([{ id, name: "Partner" }]);

      const date = new Date("2026-01-01");
      const detail = ProjectDetailSchema.parse({
        ...validCreateInput(),
        id: "project",
        archived: false,
        completedAt: null,
        completedByUserId: null,
        completedByUserName: null,
        participantCount: 2,
        daysLeft: 5,
        relationship: "partner",
        hostingOrganization: { id, name: "Host" },
        partnership: { id, claimStatus: null, assignedAt: date, updatedAt: date },
      });
      expect(detail).toMatchObject({
        hostingOrganization: { id, name: "Host" },
        partnership: { id, claimStatus: null, assignedAt: date, updatedAt: date },
      });
    },
  );
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
