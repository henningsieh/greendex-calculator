import { describe, expect, it } from "vitest";

import {
  DisableSetupLinkInputSchema,
  PartnerCoordinatorInputSchema,
} from "@/features/partnerships/validation-schemas";

describe("partnership procedure inputs", () => {
  it("normalizes coordinator identifiers and strips unknown keys", () => {
    expect(
      PartnerCoordinatorInputSchema.parse({
        partnershipId: " p ",
        userId: " u ",
        extra: true,
      }),
    ).toEqual({ partnershipId: "p", userId: "u" });
    expect(
      PartnerCoordinatorInputSchema.safeParse({
        partnershipId: " ",
        userId: "x".repeat(129),
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["partnershipId"],
        message: "Too small: expected string to have >=1 characters",
      },
      {
        path: ["userId"],
        message: "Too big: expected string to have <=128 characters",
      },
    ]);
  });
  it("normalizes setup link identifiers and reports their path", () => {
    expect(
      DisableSetupLinkInputSchema.parse({ id: " id ", extra: true }),
    ).toEqual({ id: "id" });
    expect(
      DisableSetupLinkInputSchema.safeParse({ id: " " }).error?.issues.map(
        ({ path, message }) => ({ path, message }),
      ),
    ).toEqual([
      {
        path: ["id"],
        message: "Too small: expected string to have >=1 characters",
      },
    ]);
    expect(
      DisableSetupLinkInputSchema.safeParse({
        id: "a".repeat(129),
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["id"],
        message: "Too big: expected string to have <=128 characters",
      },
    ]);
  });
});
