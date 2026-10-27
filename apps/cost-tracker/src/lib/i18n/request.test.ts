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
  it("has one nonempty app-owned bundle with the same keys and arguments per locale", async () => {
    const files = await readdir(catalogueDirectory);
    expect(files.sort()).toEqual(
      LANGUAGE_CODES.map((locale) => `${locale}.json`).sort(),
    );
    const bundles = await Promise.all(
      files.map(async (file) =>
        JSON.parse(await readFile(new URL(file, catalogueDirectory), "utf8")),
      ),
    );
    const shape = (value: unknown, prefix = ""): string[] => {
      if (typeof value === "string")
        return [
          `${prefix}:${[...value.matchAll(/\{(\w+)[},]/g)]
            .map((match) => match[1])
            .sort()
            .join(",")}`,
        ];
      if (!value || typeof value !== "object")
        throw new Error("Invalid catalogue value");
      return Object.entries(value)
        .flatMap(([key, child]) => shape(child, `${prefix}.${key}`))
        .sort();
    };
    const [reference, ...translated] = bundles.map((bundle) => shape(bundle));
    expect(reference?.length).toBeGreaterThan(0);
    for (const bundle of translated) expect(bundle).toEqual(reference);
  });

  it.each(LANGUAGE_CODES)("resolves the %s catalogue", async (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
    const config = await requestConfig({
      requestLocale: Promise.resolve(locale),
    });
    expect(config.locale).toBe(locale);
    expect(config.messages).toEqual(
      JSON.parse(
        await readFile(new URL(`${locale}.json`, catalogueDirectory), "utf8"),
      ),
    );
  });

  it.each([undefined, "", "zz", "EN", "../en"])(
    "falls back for %s",
    async (locale) => {
      expect(isSupportedLocale(locale)).toBe(false);
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      expect(config.locale).toBe(DEFAULT_LANGUAGE);
      expect(config.messages).toEqual(
        JSON.parse(
          await readFile(
            new URL(`${DEFAULT_LANGUAGE}.json`, catalogueDirectory),
            "utf8",
          ),
        ),
      );
    },
  );
});
