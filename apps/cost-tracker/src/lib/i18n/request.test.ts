// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", () => ({
  getRequestConfig: (callback: unknown) => callback,
}));

import { isSupportedLocale } from "@/lib/i18n/locales";
import requestConfig from "@/lib/i18n/request";
import { messageDomains } from "@/messages/domains";

const messagesDirectory = new URL("../../messages/", import.meta.url);

async function readBundle(
  locale: string,
  domain: string,
): Promise<Record<string, unknown>> {
  return JSON.parse(
    await readFile(
      new URL(`${locale}/${domain}.json`, messagesDirectory),
      "utf8",
    ),
  );
}

async function readMerged(locale: string): Promise<Record<string, unknown>> {
  const bundles = await Promise.all(
    messageDomains.map((domain) => readBundle(locale, domain)),
  );
  return Object.assign({}, ...bundles);
}

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

describe("Cost Tracker request catalogue", () => {
  it.each(LANGUAGE_CODES)("has one bundle per domain for %s", async (locale) => {
    const files = (await readdir(new URL(`${locale}/`, messagesDirectory)))
      .filter((file) => file.endsWith(".json"))
      .sort();
    expect(files).toEqual(
      messageDomains.map((domain) => `${domain}.json`).sort(),
    );
  });

  it("keeps the same keys and arguments per domain across locales", async () => {
    for (const domain of messageDomains) {
      const bundles = await Promise.all(
        LANGUAGE_CODES.map((locale) => readBundle(locale, domain)),
      );
      const [reference, ...translated] = bundles.map((bundle) => shape(bundle));
      for (const bundle of translated) expect(bundle).toEqual(reference);
    }
  });

  it.each(LANGUAGE_CODES)("resolves the %s merged catalogue", async (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
    const config = await requestConfig({
      requestLocale: Promise.resolve(locale),
    });
    expect(config.locale).toBe(locale);
    expect(config.messages).toEqual(await readMerged(locale));
  });

  it.each([undefined, "", "zz", "EN", "../en"])(
    "falls back for %s",
    async (locale) => {
      expect(isSupportedLocale(locale)).toBe(false);
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      expect(config.locale).toBe(DEFAULT_LANGUAGE);
      expect(config.messages).toEqual(await readMerged(DEFAULT_LANGUAGE));
    },
  );
});
