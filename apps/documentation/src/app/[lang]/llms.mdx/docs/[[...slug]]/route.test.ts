import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, generateStaticParams } from "./route";

const mocks = vi.hoisted(() => ({
  getPage: vi.fn(),
  generateParams: vi.fn(),
  getLLMText: vi.fn(),
  cacheLife: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/source", () => ({
  source: { getPage: mocks.getPage, generateParams: mocks.generateParams },
  getLLMText: mocks.getLLMText,
}));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

const request = new Request("http://localhost/en/llms.mdx/docs");
const context = (slug?: string[]) => ({
  params: Promise.resolve({ lang: "en", slug }),
});

describe("page markdown route", () => {
  it.each([undefined, [], ["guide", "start"]])(
    "resolves slug %j and serves markdown",
    async (slug) => {
      const page = { data: { title: "Guide" } };
      mocks.getPage.mockReturnValue(page);
      mocks.getLLMText.mockResolvedValue("# Guide\n\nHello ü!");
      const response = await GET(request, context(slug));
      expect(mocks.getPage).toHaveBeenCalledExactlyOnceWith(slug);
      expect(mocks.getLLMText).toHaveBeenCalledExactlyOnceWith(page);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/markdown");
      expect(await response.text()).toBe("# Guide\n\nHello ü!");
      expect(mocks.cacheLife).toHaveBeenCalledExactlyOnceWith("max");
      expect(mocks.notFound).not.toHaveBeenCalled();
    },
  );

  it("returns valid empty markdown rather than treating it as a missing page", async () => {
    mocks.getPage.mockReturnValue({ data: {} });
    mocks.getLLMText.mockResolvedValue("");
    const response = await GET(request, context(["empty"]));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("raises a 404 without attempting conversion for a missing page", async () => {
    mocks.getPage.mockReturnValue(undefined);
    await expect(GET(request, context(["missing"]))).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getLLMText).not.toHaveBeenCalled();
  });

  it("preserves conversion errors instead of turning them into 404s", async () => {
    mocks.getPage.mockReturnValue({ data: {} });
    mocks.getLLMText.mockRejectedValue(new Error("invalid MDX"));
    await expect(GET(request, context(["broken"]))).rejects.toThrow(
      "invalid MDX",
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("preserves the source's localized static parameters", () => {
    const params = [
      { lang: "en", slug: [] },
      { lang: "de", slug: ["guide"] },
    ];
    mocks.generateParams.mockReturnValue(params);
    expect(generateStaticParams()).toEqual(params);
  });
});
