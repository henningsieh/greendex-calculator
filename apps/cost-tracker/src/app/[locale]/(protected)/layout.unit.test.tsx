import { expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

vi.mock("@/components/protected-shell", () => ({
  ProtectedShell: () => {
    throw new Promise(() => {});
  },
}));
vi.mock("@/components/site-brand", () => ({
  SiteBrand: () => <span>Greendex</span>,
}));
// The layout reads the persisted sidebar state above the Suspense boundary.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

// jsdom has no matchMedia; the skeleton's sidebar resolves its viewport on mount.
vi.stubGlobal(
  "matchMedia",
  (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) satisfies Partial<MediaQueryList>,
);

import LocalizedProtectedLayout from "@/app/[locale]/(protected)/layout";

it.each([LocalizedProtectedLayout])(
  "names the loading status without placing page landmarks in its phrasing content",
  async (ProtectedLayout) => {
    const { container } = render(
      await ProtectedLayout({ children: <p>Private content</p> }),
    );
    const status = container.querySelector("output");
    expect(status?.tagName).toBe("OUTPUT");
    expect(status?.getAttribute("aria-label")).toBeTruthy();
    expect(status?.firstChild).not.toBeNull();
    expect(status?.querySelector("header, main")).toBeNull();
    expect(container.querySelector("header")).toBeInTheDocument();
    expect(container.querySelector("main")).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="protected-shell-skeleton-content"]'),
    ).toHaveClass("min-h-svh", "bg-muted/35");
  },
);
