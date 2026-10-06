import { FEATURE_FLAGS, resolveFlags } from "@greendex/config/feature-flags";
import { describe, expect, it } from "vitest";

describe("feature flags", () => {
  it("defaults every flag to off (safe)", () => {
    expect(FEATURE_FLAGS.singleOrganization).toBe(false);
    expect(resolveFlags()).toEqual({ singleOrganization: false });
  });

  it("accepts per-app overrides", () => {
    expect(resolveFlags({ singleOrganization: true })).toEqual({
      singleOrganization: true,
    });
  });
});
