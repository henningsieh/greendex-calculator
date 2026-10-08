import { LANGUAGE_CODES } from "@greendex/config/languages";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, generateStaticParams } from "./route";

const mocks = vi.hoisted(() => ({ getPages: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/source", () => ({ source: { getPages: mocks.getPages } }));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("LLM documentation index", () => {
  it("renders ordered page links and descriptions in a cached text response", async () => {
    mocks.getPages.mockReturnValue([
      {
        url: "/en/docs/start",
        data: { title: "Start", description: "Getting started" },
      },
      {
        url: "/de/docs/intro",
        data: { title: "Einführung", description: "Über Greendex" },
      },
    ]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      "# Documentation\n\n- [Start](/en/docs/start): Getting started\n- [Einführung](/de/docs/intro): Über Greendex",
    );
    expect(mocks.cacheLife).toHaveBeenCalledExactlyOnceWith("max");
  });

  it("keeps the header for an empty documentation source", async () => {
    mocks.getPages.mockReturnValue([]);
    expect(await (await GET()).text()).toBe("# Documentation\n");
  });

  it("generates exactly one static route for each supported language", () => {
    expect(generateStaticParams()).toEqual(
      LANGUAGE_CODES.map((lang) => ({ lang })),
    );
    expect(
      new Set(generateStaticParams().map((params) => params.lang)).size,
    ).toBe(LANGUAGE_CODES.length);
  });

  it("propagates source failures instead of returning a successful empty index", async () => {
    mocks.getPages.mockImplementation(() => {
      throw new Error("source unavailable");
    });
    await expect(GET()).rejects.toThrow("source unavailable");
  });
});
