import { describe, expect, it } from "vitest";

import {
  projectVisibilityPreference,
  sidebarPreference,
} from "@/lib/ui-preferences/definitions";

describe("UI preference cookie definitions", () => {
  it("preserves the legacy sidebar values and defaults to open", () => {
    expect(sidebarPreference.parse("false")).toBe(false);
    expect(sidebarPreference.parse("true")).toBe(true);
    expect(sidebarPreference.parse(undefined)).toBe(true);
    expect(sidebarPreference.parse("invalid")).toBe(true);
  });

  it("round trips only supported hidden columns", () => {
    const preference = projectVisibilityPreference("account");
    expect(preference.parse(preference.serialize({ location: false }))).toEqual({
      location: false,
    });
    expect(preference.parse(preference.serialize({ country: false }))).toEqual({
      country: false,
    });
    expect(preference.parse('[1,["unknown"]]')).toEqual({});
    expect(preference.parse('[2,["location"]]')).toEqual({});
    expect(preference.parse("{")).toEqual({});
    expect(preference.parse("x".repeat(257))).toEqual({});
    expect(preference.parse(undefined)).toEqual({});
  });
});
