// @vitest-environment node

import { readdir, readFile } from "node:fs/promises";

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", () => ({
  getRequestConfig: (callback: unknown) => callback,
}));

import { isSupportedLocale } from "@/lib/i18n/locales";
import requestConfig from "@/lib/i18n/request";
import {
  fieldIssueCatalog,
  ProjectCompletionBlockerSchema,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { createSituationErrors } from "@/lib/orpc/errors";
import { messageDomains } from "@/messages/domains";
import englishErrors from "@/messages/en/apiErrors.json";

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

const canonicalReasons = Object.fromEntries(
  Object.values(situationCatalog).map(({ reason, message }) => [reason, message]),
);

function assertReasonCatalogue(bundle: Record<string, unknown>) {
  const { fallback: _fallback, completion, details, ...reasons } = bundle;
  expect(details).toEqual(fieldIssueCatalog);
  expect(completion).toMatchObject({
    summary: expect.any(String),
    status: expect.any(Object),
  });
  const statuses =
    completion && typeof completion === "object" && "status" in completion
      ? completion.status
      : undefined;
  expect(Object.keys(statuses ?? {}).sort()).toEqual(
    [
      "none",
      ...ProjectCompletionBlockerSchema.shape.status.unwrap().options,
    ].sort(),
  );
  expect(reasons).toEqual(canonicalReasons);
}

describe("API error catalogue coverage", () => {
  it("matches the canonical English reasons without presentation overrides", () => {
    assertReasonCatalogue(englishErrors.apiErrors);
  });

  it.each(["omitted reason", "extra reason", "English drift"])(
    "rejects %s",
    (defect) => {
      const altered: Record<string, unknown> = { ...englishErrors.apiErrors };
      const reason = situationCatalog.unauthenticated.reason;
      if (defect === "omitted reason") delete altered[reason];
      if (defect === "extra reason") altered.UNKNOWN_REASON = "Unknown";
      if (defect === "English drift") altered[reason] = "Changed wording";
      expect(() => assertReasonCatalogue(altered)).toThrow();
    },
  );

  it.each([
    "omitted detail",
    "extra detail",
    "English detail drift",
    "detail argument drift",
  ])("rejects %s", (defect) => {
    const details: Record<string, string> = {
      ...englishErrors.apiErrors.details,
    };
    if (defect === "omitted detail") delete details.payoutAccountRequired;
    if (defect === "extra detail") details.UNKNOWN_DETAIL = "Unknown";
    if (defect === "English detail drift")
      details.payoutAccountRequired = "Changed wording";
    if (defect === "detail argument drift")
      details.payoutAccountRequired = "Select {account}";
    expect(() =>
      assertReasonCatalogue({ ...englishErrors.apiErrors, details }),
    ).toThrow();
  });

  it("preserves safe English internal and network presentation overrides", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("en") });
    const t = createTranslator({
      locale: "en",
      messages: config.messages ?? undefined,
      namespace: "apiErrors",
    });
    expect(t("fallback.internalFailure")).toBe(
      getORPCRequestErrorMessage(createSituationErrors().internalFailure()).text,
    );
    expect(t("fallback.networkFailure")).toBe(
      getORPCRequestErrorMessage(new Error("private network detail")).text,
    );
    expect(t("INTERNAL_FAILURE")).toBe(situationCatalog.internalFailure.message);
  });

  it("rejects mismatched translation arguments", () => {
    const altered = {
      ...englishErrors.apiErrors,
      SESSION_REQUIRED: "Sign in as {name} to continue.",
    };
    expect(() =>
      expect(shape(altered)).toEqual(shape(englishErrors.apiErrors)),
    ).toThrow();
  });

  it.each(LANGUAGE_CODES)(
    "resolves every reason through the %s request tree",
    async (locale) => {
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      const t = createTranslator({
        locale,
        messages: config.messages ?? undefined,
        namespace: "apiErrors",
      });
      const bundle = await readBundle(locale, "apiErrors");
      const reasons = bundle.apiErrors;
      if (!reasons || typeof reasons !== "object")
        throw new Error("Missing apiErrors root");
      expect(Object.keys(reasons).sort()).toEqual(
        [
          ...Object.keys(canonicalReasons),
          "fallback",
          "details",
          "completion",
        ].sort(),
      );
      for (const { reason } of Object.values(situationCatalog)) {
        expect(t(reason)).toBe(Reflect.get(reasons, reason));
      }
      const details = Reflect.get(reasons, "details");
      expect(Object.keys(details).sort()).toEqual(
        Object.keys(fieldIssueCatalog).sort(),
      );
      for (const id of Object.keys(fieldIssueCatalog)) {
        expect(t(`details.${id}`)).toBe(Reflect.get(details, id));
      }
    },
  );

  it.each(LANGUAGE_CODES)(
    "keeps lifecycle refusals distinct in %s",
    async (locale) => {
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      const t = createTranslator({
        locale,
        messages: config.messages ?? undefined,
        namespace: "apiErrors",
      });
      const reasons = [
        "SETUP_LINK_EXPIRED",
        "SETUP_LINK_USED",
        "REGISTRATION_LINK_CLOSED",
        "CLAIM_NOT_EDITABLE",
        "PARTICIPANT_ALREADY_PARTICIPATES",
        "PAYOUT_ACCOUNT_REQUIRED",
      ];
      expect(new Set(reasons.map((reason) => t(reason))).size).toBe(
        reasons.length,
      );
    },
  );

  it.each(LANGUAGE_CODES)(
    "keeps distance refusal and detail wording consistent in %s",
    async (locale) => {
      const config = await requestConfig({
        requestLocale: Promise.resolve(locale),
      });
      const t = createTranslator({
        locale,
        messages: config.messages ?? undefined,
        namespace: "apiErrors",
      });
      expect(t("details.journeyDistanceOutsideBands")).toBe(
        t("JOURNEY_DISTANCE_OUTSIDE_BANDS"),
      );
    },
  );
});
