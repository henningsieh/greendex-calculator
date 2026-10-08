import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, generateStaticParams } from "./route";

const mocks = vi.hoisted(() => ({
  getPage: vi.fn(),
  getPages: vi.fn(),
  getPageImage: vi.fn(),
  cacheLife: vi.fn(),
  notFound: vi.fn(),
  image: vi.fn(),
}));
vi.mock("@/lib/source", () => ({
  source: { getPage: mocks.getPage, getPages: mocks.getPages },
  getPageImage: mocks.getPageImage,
}));
vi.mock("next/cache", () => ({ cacheLife: mocks.cacheLife }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("fumadocs-ui/og", () => ({ generate: () => null }));
vi.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(
      element: ReactElement,
      options: { width: number; height: number },
    ) {
      super("image", { headers: { "content-type": "image/png" } });
      mocks.image(element.props, options);
    }
  },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("not found");
  });
});

const request = new Request("http://localhost/en/og/docs/image.png");
const context = (slug: string[]) => ({
  params: Promise.resolve({ lang: "en", slug }),
});

describe("documentation Open Graph route", () => {
  it.each([
    [["image.png"], []],
    [
      ["guide", "start", "image.png"],
      ["guide", "start"],
    ],
  ])(
    "looks up %j without the final image segment",
    async (slug, expectedSlug) => {
      mocks.getPage.mockReturnValue({
        data: { title: "Über Greendex", description: "A guide" },
      });
      const originalSlug = [...slug];
      const response = await GET(request, context(slug));
      expect(response.status).toBe(200);
      expect(mocks.getPage).toHaveBeenCalledExactlyOnceWith(expectedSlug);
      expect(slug).toEqual(originalSlug);
      expect(mocks.image).toHaveBeenCalledExactlyOnceWith(
        { title: "Über Greendex", description: "A guide", site: "My App" },
        { width: 1200, height: 630 },
      );
      expect(mocks.cacheLife).toHaveBeenCalledExactlyOnceWith("max");
    },
  );

  it("allows a page without a description", async () => {
    mocks.getPage.mockReturnValue({ data: { title: "Title only" } });
    await GET(request, context(["image.png"]));
    expect(mocks.image).toHaveBeenCalledWith(
      { title: "Title only", description: undefined, site: "My App" },
      { width: 1200, height: 630 },
    );
  });

  it("raises a 404 without constructing an image when the page is missing", async () => {
    mocks.getPage.mockReturnValue(undefined);
    await expect(GET(request, context(["missing", "image.png"]))).rejects.toThrow(
      "not found",
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("preserves each page's locale and generated image segments in static params", () => {
    const pages = [{ locale: "en" }, { locale: "de" }];
    mocks.getPages.mockReturnValue(pages);
    mocks.getPageImage
      .mockReturnValueOnce({ segments: ["image.png"] })
      .mockReturnValueOnce({ segments: ["guide", "image.png"] });
    expect(generateStaticParams()).toEqual([
      { lang: "en", slug: ["image.png"] },
      { lang: "de", slug: ["guide", "image.png"] },
    ]);
    expect(mocks.getPageImage.mock.calls.map(([page]) => page)).toEqual(pages);
  });
});
