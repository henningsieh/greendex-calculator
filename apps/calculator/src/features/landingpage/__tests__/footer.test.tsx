import { getTranslations } from "@greendex/i18n/server";
import { cacheLife } from "next/cache";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ABOUT_PATH,
  DASHBOARD_PATH,
  E_FOREST_PATH,
  HOME_PATH,
  LIBRARY_PATH,
  LOGIN_PATH,
  SIGNUP_PATH,
  TIPS_AND_TRICKS_PATH,
  WORKSHOPS_ANCHOR,
} from "@/app/routes";
import { FooterSection } from "@/features/landingpage/components/footer";

vi.mock("@greendex/i18n/server", () => ({ getTranslations: vi.fn() }));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/features/landingpage/components/logo", () => ({
  Logo: () => <span>Greendex</span>,
}));
vi.mock("@/lib/i18n/routing", () => ({
  // Expose the locale passed at the navigation boundary; don't emulate routing.
  Link: ({ locale, ...props }: ComponentProps<"a"> & { locale: string }) => (
    <a {...props} data-locale={locale} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(getTranslations).mockResolvedValue(
    ((key: string) => `translated:${key}`) as Awaited<
      ReturnType<typeof getTranslations>
    >,
  );
});
afterEach(() => {
  vi.useRealTimers();
});

describe("prerenderable footer", () => {
  it.each(["de", "fr"])(
    "forwards %s to translations and every navigation link, including the CTA",
    async (locale) => {
      vi.setSystemTime(new Date(2026, 5, 1));
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(await FooterSection({ locale }));
      expect(getTranslations).toHaveBeenCalledExactlyOnceWith({
        locale,
        namespace: "landingPage",
      });
      const links = Array.from(container.querySelectorAll("a"));
      expect(links.map((link) => link.getAttribute("href"))).toEqual([
        HOME_PATH,
        DASHBOARD_PATH,
        WORKSHOPS_ANCHOR,
        E_FOREST_PATH,
        TIPS_AND_TRICKS_PATH,
        LIBRARY_PATH,
        ABOUT_PATH,
        LOGIN_PATH,
        SIGNUP_PATH,
      ]);
      for (const link of links) expect(link.dataset.locale).toBe(locale);
      expect(container.textContent).toContain("translated:footer.copyright");
    },
  );

  it.each([
    [new Date(2026, 11, 31, 23, 59, 59), 2026],
    [new Date(2027, 0, 1, 0, 0, 0), 2027],
  ])("renders the year at %s with the max cache lifetime", async (now, year) => {
    vi.setSystemTime(now);
    const html = renderToStaticMarkup(await FooterSection({ locale: "en" }));
    expect(html).toContain(`© ${year} Greendex`);
    expect(cacheLife).toHaveBeenCalledExactlyOnceWith("max");
  });
});
