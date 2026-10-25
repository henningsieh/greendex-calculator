import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { describe, expect, it } from "vitest";

type MessageCatalog = {
  [key: string]: MessageCatalog | string;
};

function isMessageCatalog(value: unknown): value is MessageCatalog {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadMessages(locale: string): Promise<MessageCatalog> {
  return (await import(`@/messages/${locale}.json`)).default;
}

function collectMessageLeaves(
  messages: MessageCatalog,
  path = "",
  leaves = new Map<string, string>(),
): Map<string, string> {
  for (const [key, value] of Object.entries(messages)) {
    const messagePath = path ? `${path}.${key}` : key;
    if (typeof value === "string") {
      leaves.set(messagePath, value);
      continue;
    }

    if (!isMessageCatalog(value)) {
      throw new Error(`Expected a message catalog or string at ${messagePath}`);
    }

    collectMessageLeaves(value, messagePath, leaves);
  }

  return leaves;
}

function getIcuPlaceholders(message: string): string[] {
  return [
    ...new Set(
      Array.from(message.matchAll(/\{\s*([\p{L}_][\p{L}\p{N}_-]*)/gu)).map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

describe("i18n message catalogs", () => {
  it.each(LANGUAGE_CODES)("loads the configured %s catalog", async (locale) => {
    const messages = await loadMessages(locale);

    expect(messages).toBeDefined();
  });

  it("keeps every configured catalog structurally aligned with the default", async () => {
    const referenceLeaves = collectMessageLeaves(
      await loadMessages(DEFAULT_LANGUAGE),
    );

    for (const locale of LANGUAGE_CODES) {
      const localeLeaves = collectMessageLeaves(await loadMessages(locale));

      expect([...localeLeaves.keys()].sort(), locale).toEqual(
        [...referenceLeaves.keys()].sort(),
      );
      expect(
        [...localeLeaves.values()].every((message) => message.trim() !== ""),
      ).toBe(true);
    }
  });

  it("uses canonical shared-travel namespaces", async () => {
    for (const locale of LANGUAGE_CODES) {
      const messageLeaves = collectMessageLeaves(await loadMessages(locale));

      expect(messageLeaves.has("project.shared-travel.title"), locale).toBe(true);
      expect(
        messageLeaves.has("project.details.tabs.shared-travel"),
        locale,
      ).toBe(true);
      expect(
        messageLeaves.has(
          "participation.questionnaire.project-shared-travel.title",
        ),
        locale,
      ).toBe(true);
      expect(messageLeaves.has("project.activities.title"), locale).toBe(false);
      expect(messageLeaves.has("project.details.activities"), locale).toBe(false);
      expect(
        messageLeaves.has("participation.questionnaire.project-activities.title"),
        locale,
      ).toBe(false);
    }
  });

  it("keeps ICU placeholders aligned with the default catalog", async () => {
    const referenceLeaves = collectMessageLeaves(
      await loadMessages(DEFAULT_LANGUAGE),
    );

    for (const locale of LANGUAGE_CODES) {
      const localeLeaves = collectMessageLeaves(await loadMessages(locale));

      for (const [messagePath, referenceMessage] of referenceLeaves) {
        const localizedMessage = localeLeaves.get(messagePath);
        expect(localizedMessage, `${locale}:${messagePath}`).toBeDefined();
        expect(
          getIcuPlaceholders(localizedMessage ?? ""),
          `${locale}:${messagePath}`,
        ).toEqual(getIcuPlaceholders(referenceMessage));
      }
    }
  });
});
