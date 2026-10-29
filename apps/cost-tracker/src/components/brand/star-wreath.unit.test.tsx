import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { StarWreath } from "@/components/brand/star-wreath";

it("preserves the named inline image, brand fill, sizing and forwarded SVG props", () => {
  render(<StarWreath size={48} className="brand-test" data-testid="wreath" />);
  const image = screen.getByTestId("wreath");
  expect(image).toHaveAttribute("role", "img");
  expect(image.getAttribute("aria-label")).toBeTruthy();
  expect(image).toHaveAttribute("width", "48");
  expect(image).toHaveAttribute("height", "48");
  expect(image).toHaveAttribute("viewBox", "0 0 80 80");
  expect(image).toHaveClass("shrink-0", "brand-test");
  expect(image).toHaveAttribute("data-testid", "wreath");
  expect(image.querySelectorAll('circle[fill="var(--brand)"]')).toHaveLength(12);
});
