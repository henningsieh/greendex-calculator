import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

it("links each ancestor and marks exactly one non-link as the current page", () => {
  render(
    <BreadcrumbTrail
      current="Participants"
      items={[
        { label: "Projects", href: "/projects" },
        { label: "Hosted Project", href: "/projects/project-42" },
      ]}
    />,
  );

  const navigation = screen.getByRole("navigation");
  expect(
    within(navigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/en-GB/projects", "/en-GB/projects/project-42"]);
  expect(within(navigation).getAllByRole("listitem")).toHaveLength(3);
  const current = navigation.querySelectorAll('[aria-current="page"]');
  expect(current).toHaveLength(1);
  expect(current[0]).not.toHaveAttribute("href");
});

it("renders only the current page when the route has no ancestors", () => {
  render(<BreadcrumbTrail current="Projects" items={[]} />);

  const navigation = screen.getByRole("navigation");
  expect(within(navigation).getAllByRole("listitem")).toHaveLength(1);
  expect(within(navigation).queryAllByRole("link")).toHaveLength(0);
});
