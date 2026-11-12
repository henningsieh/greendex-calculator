import { organization } from "@greendex/database/schema";
import { expect, expectTypeOf, it } from "vitest";

import {
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
