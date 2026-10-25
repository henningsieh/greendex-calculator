// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", () => ({
  getRequestConfig: (callback: unknown) => callback,
}));

import { isSupportedLocale } from "@/lib/i18n/locales";
import requestConfig from "@/lib/i18n/request";

const catalogueDirectory = new URL("../../messages/", import.meta.url);

describe("Cost Tracker request catalogue", () => {
  it("has exactly one empty app-owned bundle per supported locale", async () => {
    const files = await readdir(catalogueDirectory);
    expect(files.sort()).toEqual(
      LANGUAGE_CODES.map((locale) => `${locale}.json`).sort(),
    );
    for (const file of files) {
      expect(
        JSON.parse(await readFile(new URL(file, catalogueDirectory), "utf8")),
      ).toEqual({});
    }
  });

  it.each(LANGUAGE_CODES)("resolves the %s catalogue", async (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
    const config = await requestConfig({
      requestLocale: Promise.resolve(locale),
    });
    expect(config.locale).toBe(locale);
    expect(config.messages).toEqual({});
  });

  it.each([undefined, "", "zz", "EN", "../en"])(
    "falls back for %s",
    async (locale) => {
      expect(isSupportedLocale(locale)).toBe(false);
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      expect(config.locale).toBe(DEFAULT_LANGUAGE);
      expect(config.messages).toEqual({});
    },
  );
});
