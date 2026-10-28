// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { createTranslator, type useTranslations } from "@greendex/i18n/client";
import type { getTranslations } from "@greendex/i18n/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type apiErrors from "@/messages/api-errors/en.json";

vi.mock("@greendex/i18n/server", () => ({
  getRequestConfig: (callback: unknown) => callback,
}));

import { isSupportedLocale } from "@/lib/i18n/locales";
import requestConfig from "@/lib/i18n/request";
import { situationCatalog } from "@/lib/orpc/error-contract";

const catalogueDirectory = new URL("../../messages/", import.meta.url);
const apiErrorsDirectory = new URL("api-errors/", catalogueDirectory);

async function expectedMessages(locale: string) {
  return {
    ...JSON.parse(
      await readFile(new URL(`${locale}.json`, catalogueDirectory), "utf8"),
    ),
    apiErrors: JSON.parse(
      await readFile(new URL(`${locale}.json`, apiErrorsDirectory), "utf8"),
    ),
  };
}

describe("Cost Tracker request catalogue", () => {
  it("has one nonempty app-owned bundle with the same keys and arguments per locale", async () => {
    const files = (await readdir(catalogueDirectory)).filter((file) =>
      file.endsWith(".json"),
    );
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
    expect(config.messages).toEqual(await expectedMessages(locale));
  });

  it.each([undefined, "", "zz", "EN", "../en"])(
    "falls back for %s",
    async (locale) => {
      expect(isSupportedLocale(locale)).toBe(false);
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      expect(config.locale).toBe(DEFAULT_LANGUAGE);
      expect(config.messages).toEqual(await expectedMessages(DEFAULT_LANGUAGE));
    },
  );
});

describe("API-error catalogues", () => {
  it("types client and server translation keys from the merged namespace", () => {
    type ClientTranslator = ReturnType<typeof useTranslations<"apiErrors">>;
    type ServerTranslator = Awaited<
      ReturnType<typeof getTranslations<"apiErrors">>
    >;
    expectTypeOf<Parameters<ClientTranslator>[0]>().toEqualTypeOf<
      keyof typeof apiErrors
    >();
    expectTypeOf<Parameters<ServerTranslator>[0]>().toEqualTypeOf<
      keyof typeof apiErrors
    >();
  });

  it("keeps English copy aligned with the canonical situation catalogue", async () => {
    const { apiErrors } = await expectedMessages("en");
    expect(apiErrors).toEqual(
      Object.fromEntries(
        Object.values(situationCatalog).map(({ reason, message }) => [
          reason,
          message,
        ]),
      ),
    );
  });

  it.each(LANGUAGE_CODES)(
    "resolves every reason in %s alongside UI copy",
    async (locale) => {
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      const expected = await expectedMessages("en");
      const messages = config.messages;
      if (!messages?.apiErrors) throw new Error("Missing API-error namespace");
      expect(Object.keys(messages.apiErrors).sort()).toEqual(
        Object.keys(expected.apiErrors).sort(),
      );
      const errors = createTranslator({
        locale,
        messages,
        namespace: "apiErrors",
      });
      const translated = (await expectedMessages(locale)).apiErrors;
      expect(errors("SESSION_REQUIRED")).toBe(translated.SESSION_REQUIRED);
      for (const { reason, message } of Object.values(situationCatalog)) {
        expect(errors(reason)).toBe(translated[reason]);
        const argumentsOf = (copy: string) =>
          [...copy.matchAll(/\{(\w+)[},]/g)].map((match) => match[1]).sort();
        expect(argumentsOf(translated[reason])).toEqual(argumentsOf(message));
      }
      const ui = createTranslator({ locale, messages });
      expect(ui.has("apiErrors.SESSION_REQUIRED")).toBe(true);
      expect(config.messages).toEqual(await expectedMessages(locale));
    },
  );
});
