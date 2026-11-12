import { describe, expect, it } from "vitest";

import {
  AcceptOrganizationInvitationInputSchema,
  OptionalEmptyInputSchema,
} from "@/features/organizations/validation-schemas";

describe("organization procedure inputs", () => {
  it("accepts omitted input and strips unknown keys, but rejects null", () => {
    expect(OptionalEmptyInputSchema.parse(undefined)).toBeUndefined();
    expect(OptionalEmptyInputSchema.parse({})).toEqual({});
    expect(OptionalEmptyInputSchema.parse({ extra: true })).toEqual({});
    expect(
      OptionalEmptyInputSchema.safeParse(null).error?.issues.map(
        ({ path, message }) => ({ path, message }),
      ),
    ).toEqual([
      { path: [], message: "Invalid input: expected object, received null" },
    ]);
  });

  it("preserves invitation identifier whitespace and checks raw length", () => {
    expect(
      AcceptOrganizationInvitationInputSchema.parse({
        invitationId: "  id  ",
        extra: true,
      }),
    ).toEqual({ invitationId: "  id  " });
    expect(
      AcceptOrganizationInvitationInputSchema.parse({ invitationId: " " }),
    ).toEqual({ invitationId: " " });
    expect(
      AcceptOrganizationInvitationInputSchema.parse({
        invitationId: "a".repeat(128),
      }),
    ).toEqual({ invitationId: "a".repeat(128) });
    expect(
      AcceptOrganizationInvitationInputSchema.safeParse({
        invitationId: "",
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["invitationId"],
        message: "Too small: expected string to have >=1 characters",
      },
    ]);
    expect(
      AcceptOrganizationInvitationInputSchema.safeParse({
        invitationId: "a".repeat(129),
      }).error?.issues.map(({ path, message }) => ({ path, message })),
    ).toEqual([
      {
        path: ["invitationId"],
        message: "Too big: expected string to have <=128 characters",
      },
    ]);
  });
});
