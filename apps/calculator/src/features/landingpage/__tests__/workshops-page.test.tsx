import { getTranslations, setRequestLocale } from "@greendex/i18n/server";
import { createContext, type ReactNode, useContext } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkshopsPage from "@/app/[locale]/(landingpage)/workshops/page";

vi.mock("@greendex/i18n/server", () => ({
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}));
vi.mock("@/components/providers/nuqs-adapter", () => ({
  NuqsProvider: ({ children }: { children: ReactNode }) => (
    <AdapterContext.Provider value={true}>{children}</AdapterContext.Provider>
  ),
}));
vi.mock(
  "@/features/landingpage/components/workshops/workshop-tab-select",
  () => ({
    WorkshopContent: ({ initialType }: { initialType: string }) => {
      if (!useContext(AdapterContext))
        throw new Error("Workshop tabs require the URL-state adapter");
      return <output data-testid="selected-workshop">{initialType}</output>;
    },
  }),
);

const AdapterContext = createContext(false);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTranslations).mockResolvedValue(
    ((key: string) => `workshops:${key}`) as Awaited<
      ReturnType<typeof getTranslations>
    >,
  );
});

describe("workshops page", () => {
  it.each([
    [undefined, "moment"],
    ["", "moment"],
    ["moment", "moment"],
    ["deal", "deal"],
    ["day", "day"],
    ["unknown", "moment"],
    ["DEAL", "moment"],
    [" deal ", "moment"],
  ])("selects %s as %s inside the URL-state provider", async (type, expected) => {
    for (const searchParams of [{ type }, Promise.resolve({ type })]) {
      const stream = await renderToReadableStream(
        await WorkshopsPage({
          params: Promise.resolve({ locale: "de" }),
          searchParams,
        }),
      );
      await stream.allReady;
      const html = document.createElement("div");
      html.innerHTML = await new Response(stream).text();
      expect(
        html.querySelector('[data-testid="selected-workshop"]')?.textContent,
      ).toBe(expected);
      expect(html.querySelector("h1")?.textContent).toContain(
        "workshops:headingPrefix",
      );
    }
    expect(setRequestLocale).toHaveBeenCalledWith("de");
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "de",
      namespace: "landingPage.workshops",
    });
  });

  it("streams the heading and placeholder before the requested tab resolves", async () => {
    const deferred = Promise.withResolvers<{ type?: string }>();
    const page = await WorkshopsPage({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: deferred.promise,
    });
    const stream = await renderToReadableStream(page);
    const reader = stream.getReader();
    let remainder = "";
    try {
      const first = await reader.read();
      const shell = new TextDecoder().decode(first.value);
      expect(shell).toContain('data-testid="workshops-shell-marker"');
      expect(shell).toContain("workshops:headingEmphasis");
      expect(shell).toContain('aria-hidden="true"');
      expect(shell).not.toContain('data-testid="selected-workshop"');
    } finally {
      deferred.resolve({ type: "deal" });
      let chunk = await reader.read();
      while (!chunk.done) {
        remainder += new TextDecoder().decode(chunk.value);
        chunk = await reader.read();
      }
      reader.releaseLock();
    }
    const html = document.createElement("div");
    html.innerHTML = remainder;
    expect(
      html.querySelector('[data-testid="selected-workshop"]')?.textContent,
    ).toBe("deal");
  }, 2000);
});
