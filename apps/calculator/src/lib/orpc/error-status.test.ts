import { describe, expect, it } from "vitest";

import { getErrorStatus } from "@/lib/orpc/error-status";

describe("getErrorStatus", () => {
  it("maps a known error code", () => {
    expect(getErrorStatus("BAD_REQUEST")).toBe(400);
  });

  it.each(["UNKNOWN_CODE", "toString", "constructor", "__proto__"])(
    "falls back for %s",
    (code) => {
      expect(getErrorStatus(code)).toBe(500);
    },
  );
});
