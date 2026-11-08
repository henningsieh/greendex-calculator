// @vitest-environment node
import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { isPresentationRefusal } from "@/lib/orpc/presentation-refusal";

describe("isPresentationRefusal", () => {
  it.each(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"])(
    "treats %s as a presentation refusal",
    (code) => {
      expect(isPresentationRefusal(new ORPCError(code))).toBe(true);
    },
  );

  it.each([
    { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
  ])("treats $reason as a presentation refusal", (data) => {
    expect(isPresentationRefusal(new ORPCError("BAD_REQUEST", { data }))).toBe(
      true,
    );
  });

  it("lets real failures through", () => {
    expect(
      isPresentationRefusal(
        new ORPCError("BAD_REQUEST", { data: { reason: "INVALID_INPUT" } }),
      ),
    ).toBe(false);
    expect(isPresentationRefusal(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(
      false,
    );
    expect(isPresentationRefusal(new Error("boom"))).toBe(false);
    expect(isPresentationRefusal(undefined)).toBe(false);
  });
});
