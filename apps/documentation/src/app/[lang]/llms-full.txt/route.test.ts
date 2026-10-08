import { LANGUAGE_CODES } from "@greendex/config/languages";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, generateStaticParams } from "./route";

const mocks = vi.hoisted(() => ({
  getPages: vi.fn(),
  getLLMText: vi.fn(),
  cacheLife: vi.fn(),
}));
vi.mock("@/lib/source", () => ({
  source: { getPages: mocks.getPages },
  getLLMText: mocks.getLLMText,
}));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
beforeEach(() => {
  vi.resetAllMocks();
});

describe("full LLM documentation", () => {
  it("waits for all pages and preserves source order when conversion finishes out of order", async () => {
    const first = Promise.withResolvers<string>();
    const second = Promise.withResolvers<string>();
    const pages = [{ url: "/en/docs/first" }, { url: "/de/docs/second" }];
    mocks.getPages.mockReturnValue(pages);
    mocks.getLLMText
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const result = GET();
    expect(mocks.getLLMText.mock.calls.map(([page]) => page)).toEqual(pages);
    second.resolve("# Zweite Seite");
    first.resolve("# First page");
    const response = await result;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# First page\n\n# Zweite Seite");
    expect(mocks.cacheLife).toHaveBeenCalledExactlyOnceWith("max");
  });

  it("returns an empty body when there are no pages", async () => {
    mocks.getPages.mockReturnValue([]);
    expect(await (await GET()).text()).toBe("");
    expect(mocks.getLLMText).not.toHaveBeenCalled();
  });

  it("does not add separators around a single page", async () => {
    mocks.getPages.mockReturnValue([{ url: "/en/docs" }]);
    mocks.getLLMText.mockResolvedValue("# Only page\n");
    expect(await (await GET()).text()).toBe("# Only page\n");
  });

  it("rejects a failed conversion instead of returning partial documentation", async () => {
    mocks.getPages.mockReturnValue([{}, {}]);
    mocks.getLLMText
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("conversion failed"));
    await expect(GET()).rejects.toThrow("conversion failed");
  });

  it("prerenders all supported language routes", () => {
    expect(generateStaticParams()).toEqual(
      LANGUAGE_CODES.map((lang) => ({ lang })),
    );
  });
});
