import { LANGUAGE_CODES } from "@greendex/config/languages";
import { useTranslations } from "@greendex/i18n/client";
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LocaleLayout, { generateStaticParams } from "@/app/[locale]/layout";

const mocks = vi.hoisted(() => ({
  getMessages: vi.fn(),
  getTimeZone: vi.fn(),
  setRequestLocale: vi.fn(),
  cacheLife: vi.fn(),
  notFound: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("@/lib/orpc/client.server", () => ({}));
vi.mock("next/font/google", () => ({
  Comfortaa: () => ({ variable: "heading" }),
  DM_Sans: () => ({ className: "body", variable: "body" }),
  JetBrains_Mono: () => ({ variable: "mono" }),
}));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "display" }) }));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/i18n/routing", async () => {
  const { LANGUAGE_CODES } = await import("@greendex/config/languages");
  return { routing: { locales: LANGUAGE_CODES } };
});
vi.mock("@greendex/i18n/server", () => ({
  getMessages: mocks.getMessages,
  getTimeZone: mocks.getTimeZone,
  setRequestLocale: mocks.setRequestLocale,
}));
vi.mock("@greendex/i18n/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@greendex/i18n/client")>();
  return {
    ...original,
    NextIntlClientProvider: (
      props: Parameters<typeof original.NextIntlClientProvider>[0],
    ) => {
      mocks.provider(props);
      return <original.NextIntlClientProvider {...props} />;
    },
  };
});
vi.mock("@/components/providers/query-provider", () => ({
  QueryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/providers/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

function Greeting() {
  const t = useTranslations("test");
  return <p>{t("greeting")}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-12-31T23:59:59Z"));
  mocks.getMessages.mockResolvedValue({ test: { greeting: "Hallo" } });
  mocks.getTimeZone.mockResolvedValue("Europe/Berlin");
  mocks.notFound.mockImplementation(() => {
    throw new Error("not found");
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("locale layout", () => {
  it.each(LANGUAGE_CODES)(
    "provides all intl values explicitly for %s and renders translated children",
    async (locale) => {
      const stream = await renderToReadableStream(
        LocaleLayout({
          params: Promise.resolve({ locale }),
          children: <Greeting />,
        }),
      );
      await stream.allReady;
      const html = await new Response(stream).text();
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain("<p>Hallo</p>");
      expect(mocks.setRequestLocale).toHaveBeenCalledExactlyOnceWith(locale);
      expect(mocks.getMessages).toHaveBeenCalledExactlyOnceWith({ locale });
      expect(mocks.getTimeZone).toHaveBeenCalledExactlyOnceWith({ locale });
      expect(mocks.provider).toHaveBeenCalledWith(
        expect.objectContaining({
          locale,
          messages: { test: { greeting: "Hallo" } },
          timeZone: "Europe/Berlin",
          now: new Date("2026-12-31T23:59:59Z"),
          formats: {},
        }),
      );
      expect(mocks.cacheLife).toHaveBeenCalledExactlyOnceWith("max");
      expect(mocks.notFound).not.toHaveBeenCalled();
    },
  );

  it.each(["", "DE", "unsupported"])(
    "rejects unsupported locale %j before loading any messages",
    async (locale) => {
      const errors: unknown[] = [];
      const stream = await renderToReadableStream(
        LocaleLayout({
          params: Promise.resolve({ locale }),
          children: "content",
        }),
        {
          onError(error: unknown) {
            errors.push(error);
          },
        },
      );
      await stream.allReady.then(() => new Response(stream).text());
      expect(
        errors.map((error) =>
          error instanceof Error ? error.message : String(error),
        ),
      ).toContain("not found");
      expect(mocks.setRequestLocale).not.toHaveBeenCalled();
      expect(mocks.getMessages).not.toHaveBeenCalled();
      expect(mocks.getTimeZone).not.toHaveBeenCalled();
      expect(mocks.cacheLife).not.toHaveBeenCalled();
    },
  );

  it("generates a static route for each supported locale", () => {
    expect(generateStaticParams()).toEqual(
      LANGUAGE_CODES.map((locale) => ({ locale })),
    );
  });
});
