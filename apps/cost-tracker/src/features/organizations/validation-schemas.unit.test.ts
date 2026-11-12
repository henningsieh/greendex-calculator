import { organization } from "@greendex/database/schema";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  OrganizationIdSchema,
  OrganizationOptionSchema,
  type OrganizationOption,
} from "@/features/organizations/validation-schemas";

it("derives an id/name option from the Organization table", () => {
  expectTypeOf<OrganizationOption>().toEqualTypeOf<
    Pick<typeof organization.$inferSelect, "id" | "name">
  >();
  expect(
    OrganizationOptionSchema.parse({
      id: "org",
      name: "Example",
      slug: "private",
    }),
  ).toEqual({
    id: "org",
    name: "Example",
  });
  expect(
    OrganizationOptionSchema.safeParse({ id: 1, name: "Example" }).success,
  ).toBe(false);
});

describe("OrganizationIdSchema", () => {
  it("trims identifiers before validating their length", () => {
    expect(OrganizationIdSchema.parse("  id  ")).toBe("id");
    expect(OrganizationIdSchema.parse("a".repeat(128))).toBe("a".repeat(128));
    expect(OrganizationIdSchema.parse("  " + "a".repeat(128) + "  ")).toBe(
      "a".repeat(128),
    );
  });

  it.each(["", "   ", "a".repeat(129), "  " + "a".repeat(129) + "  "])(
    "rejects invalid identifier %s",
    (value) => {
      expect(OrganizationIdSchema.safeParse(value).success).toBe(false);
    },
  );
});
