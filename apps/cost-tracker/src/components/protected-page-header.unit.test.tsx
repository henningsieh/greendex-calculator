import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import ProtectedPageHeader from "@/components/protected-page-header";

it("preserves explicit return destinations and identifies the current page without a destination", () => {
  render(
    <ProtectedPageHeader
      eyebrow="Claims"
      title="Review claim"
      breadcrumbs={[
        { label: "Claim reviews", href: "/claims/review" },
        { label: "Project · Partner" },
      ]}
    />,
  );
  const navigation = screen.getByRole("navigation");
  expect(
    within(navigation).getByRole("link", { current: false }),
  ).toHaveAttribute("href", "/claims/review");
  expect(within(navigation).getAllByRole("listitem")[1]!).not.toHaveAttribute(
    "href",
  );
  expect(
    within(navigation).getByRole("link", { current: "page" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    within(navigation).getByRole("link", { current: "page" }),
  ).not.toHaveAttribute("href");
});
