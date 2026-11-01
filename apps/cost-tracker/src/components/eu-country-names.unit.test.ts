import { afterEach, describe, expect, it, vi } from "vitest";

import { getEUCountryOptions } from "@/components/eu-country-names";

afterEach(() => vi.restoreAllMocks());

describe("getEUCountryOptions", () => {
  it("maps the product si locale to Slovenian presentation", () => {
    expect(getEUCountryOptions("si")).toEqual(getEUCountryOptions("sl"));
    expect(
      getEUCountryOptions("si").find((item) => item.code === "DE")?.label,
    ).toBe("Nemčija");
  });
  it("falls back to English for an invalid locale", () => {
    expect(getEUCountryOptions("not_a_locale")).toEqual(
      getEUCountryOptions("en"),
    );
  });
  it("falls back to English when a localized region name is missing", () => {
    const Original = Intl.DisplayNames;
    vi.spyOn(Intl, "DisplayNames").mockImplementation(
      function (locales, options) {
        const names = new Original(locales, options);
        if (Array.isArray(locales) && locales[0] === "de")
          vi.spyOn(names, "of").mockReturnValue(undefined);
        return names;
      },
    );
    expect(
      getEUCountryOptions("de").find((item) => item.code === "DE")?.label,
    ).toBe("Germany");
  });
  it("keeps ISO codes selectable when DisplayNames is unavailable", () => {
    vi.spyOn(Intl, "DisplayNames").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    expect(
      getEUCountryOptions("de").find((item) => item.code === "DE")?.label,
    ).toBe("DE");
  });
});
