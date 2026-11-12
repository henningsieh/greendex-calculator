import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

import { ProjectOptionsLoading } from "./project-options-loading";

it("labels the options loading state", () => {
  render(<ProjectOptionsLoading />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
});
