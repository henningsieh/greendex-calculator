// @vitest-environment node

import { PassThrough } from "node:stream";

import { LANGUAGE_CODES } from "@greendex/config/languages";
import type { ReactNode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMessages: vi.fn().mockResolvedValue({}),
  getTimeZone: vi.fn().mockResolvedValue("UTC"),
  setRequestLocale: vi.fn(),
  provider: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@greendex/i18n/server", () => ({
  getMessages: mocks.getMessages,
  getTimeZone: mocks.getTimeZone,
  setRequestLocale: mocks.setRequestLocale,
}));
vi.mock("@greendex/i18n/client", () => ({
  NextIntlClientProvider: (props: { children: ReactNode }) => {
    mocks.provider(props);
    return props.children;
  },
}));
vi.mock("@/lib/i18n/routing", () => ({ routing: { locales: LANGUAGE_CODES } }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import LocaleLayout, { generateStaticParams } from "@/app/[locale]/layout";

function render(locale: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = "";
    output.setEncoding("utf8");
    output.on("data", (chunk: string) => {
      html += chunk;
    });
    output.on("end", () => resolve(html));
    const stream = renderToPipeableStream(
      <LocaleLayout params={Promise.resolve({ locale })}>
        <main data-testid="locale-child" />
      </LocaleLayout>,
      { onAllReady: () => stream.pipe(output), onError: reject },
    );
  });
}

describe("Cost Tracker locale layout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates every supported locale", () => {
    expect(generateStaticParams()).toEqual(
      LANGUAGE_CODES.map((locale) => ({ locale })),
    );
  });

  it.each(LANGUAGE_CODES)(
    "provides the explicit %s catalogue and locale",
    async (locale) => {
      const html = await render(locale);
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain('data-testid="locale-child"');
      expect(mocks.setRequestLocale).toHaveBeenCalledWith(locale);
      expect(mocks.getMessages).toHaveBeenCalledWith({ locale });
      expect(mocks.getTimeZone).toHaveBeenCalledWith({ locale });
      expect(mocks.provider).toHaveBeenCalledWith(
        expect.objectContaining({
          locale,
          messages: {},
          timeZone: "UTC",
          now: expect.any(Date),
          formats: {},
        }),
      );
    },
  );

  it("rejects unsupported segments before loading a catalogue", async () => {
    await expect(render("zz")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.setRequestLocale).not.toHaveBeenCalled();
    expect(mocks.getMessages).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
});
