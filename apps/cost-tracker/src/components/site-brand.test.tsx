import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { SiteBrand } from "@/components/site-brand";

describe("SiteBrand", () => {
  it("renders the canonical GreenDex wordmark and accessible wreath name", () => {
    render(<SiteBrand />);

    expect(screen.getByTestId("site-brand-name")).toBeVisible();
    expect(screen.getByTestId("site-brand-mark")).toBeVisible();
    expect(screen.getByTestId("site-brand")).toHaveAttribute("href", "/");
  });
});
