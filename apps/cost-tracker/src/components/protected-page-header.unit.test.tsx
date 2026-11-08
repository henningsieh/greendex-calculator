import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import ProtectedPageHeader from "@/components/protected-page-header";

it("renders one page identity and its action without owning navigation", () => {
  const { container } = render(
    <ProtectedPageHeader
      eyebrow="Claims"
      title="Review claim"
      description="Check the claim before approving it."
      rightButton={<button type="button">Approve</button>}
    />,
  );

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  // Eyebrow + description paragraphs.
  expect(container.querySelectorAll("p")).toHaveLength(2);
  // Breadcrumbs belong to the shell slot, so the header must not render a nav.
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

it("omits optional description and action", () => {
  const { container } = render(
    <ProtectedPageHeader eyebrow="Projects" title="Projects" />,
  );

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelectorAll("p")).toHaveLength(1);
});
