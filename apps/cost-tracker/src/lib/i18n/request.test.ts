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
import { fieldIssueCatalog, situationCatalog } from "@/lib/orpc/error-contract";
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
  const {
    fallback: _fallback,
    completion: _completion,
    details,
    ...reasons
  } = bundle;
  expect(details).toEqual(fieldIssueCatalog);
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
    },
  );

  it("keeps German lifecycle refusals distinct and actionable", async () => {
    const config = await requestConfig({ requestLocale: Promise.resolve("de") });
    const t = createTranslator({
      locale: "de",
      messages: config.messages ?? undefined,
      namespace: "apiErrors",
    });
    expect(t("SETUP_LINK_EXPIRED")).toBe(
      "Dieser Einrichtungslink ist abgelaufen.",
    );
    expect(t("SETUP_LINK_USED")).toBe(
      "Dieser Einrichtungslink wurde bereits verwendet.",
    );
    expect(t("REGISTRATION_LINK_CLOSED")).toBe(
      "Der Registrierungslink ist geschlossen.",
    );
    expect(t("CLAIM_NOT_EDITABLE")).toBe("Der Claim ist nicht bearbeitbar.");
    expect(t("PARTICIPANT_ALREADY_PARTICIPATES")).toBe(
      "Diese Person nimmt bereits an diesem Projekt teil.",
    );
    expect(t("PAYOUT_ACCOUNT_REQUIRED")).toBe(
      "Wähle einen Payout Account der Partnerorganisation aus, bevor du den Claim speicherst.",
    );
  });
});
