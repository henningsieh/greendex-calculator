import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteBrand } from "@/components/site-brand";

describe("SiteBrand", () => {
  it("renders the canonical GreenDex wordmark and accessible wreath name", () => {
    render(<SiteBrand />);

    expect(screen.getByText("GreenDex")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "GreenDex star wreath" }),
    ).toBeVisible();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
