import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@/app/(protected)/protected-shell", () => ({
  ProtectedShell: () => {
    throw new Promise(() => {});
  },
}));
vi.mock("@/components/site-brand", () => ({
  SiteBrand: () => <span>Greendex</span>,
}));

import ProtectedLayout from "@/app/(protected)/layout";

it("names the loading status without placing page landmarks in its phrasing content", () => {
  const { container } = render(
    <ProtectedLayout>
      <p>Private content</p>
    </ProtectedLayout>,
  );
  const status = container.querySelector("output");
  expect(status?.tagName).toBe("OUTPUT");
  expect(status?.getAttribute("aria-label")).toBeTruthy();
  expect(status?.firstChild).not.toBeNull();
  expect(status?.querySelector("header, main")).toBeNull();
  expect(container.querySelector("header")).toBeInTheDocument();
  expect(container.querySelector("main")).toBeInTheDocument();
  expect(container.firstElementChild).toHaveClass("min-h-svh", "bg-muted/35");
});
