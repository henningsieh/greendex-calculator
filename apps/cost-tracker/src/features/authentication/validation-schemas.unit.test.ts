import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import { describe, expect, it } from "vitest";

import { CreateOrganizationInputSchema } from "@/features/authentication/validation-schemas";

const country = EU_COUNTRY_CODES[0];

describe("Organization creation input", () => {
  it("accepts a complete Organization and trims text fields", () => {
    expect(
      CreateOrganizationInputSchema.parse({
        name: "  Harbour Collective  ",
        slug: "  harbour-collective  ",
        country,
      }),
    ).toEqual({
      name: "Harbour Collective",
      slug: "harbour-collective",
      country,
    });
  });

  it("rejects short names and slugs", () => {
    expect(
      CreateOrganizationInputSchema.safeParse({
        name: "A",
        slug: "harbour-collective",
        country,
      }).success,
    ).toBe(false);
    expect(
      CreateOrganizationInputSchema.safeParse({
        name: "Harbour Collective",
        slug: " ",
        country,
      }).success,
    ).toBe(false);
  });

  it("rejects overlong fields and non-EU countries", () => {
    expect(
      CreateOrganizationInputSchema.safeParse({
        name: "a".repeat(101),
        slug: "harbour-collective",
        country,
      }).success,
    ).toBe(false);
    expect(
      CreateOrganizationInputSchema.safeParse({
        name: "Harbour Collective",
        slug: "harbour-collective",
        country: "XX",
      }).success,
    ).toBe(false);
  });
});
