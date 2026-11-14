import { screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { SidebarProvider } from "@/components/ui/sidebar";
import BreadcrumbTrail from "@/features/breadcrumbs/components/breadcrumb-trail";

// jsdom has no matchMedia; the shell's sidebar trigger reads it on mount.
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

it("links earlier crumbs to their destinations and leaves the current page unlinked", () => {
  const { container } = render(
    <SidebarProvider>
      <BreadcrumbTrail
        current="Participants"
        items={[
          {
            label: "Projects",
            href: "/projects",
            testId: "back-to-projects",
          },
          {
            label: "Partnership",
            href: "/partnerships/partnership-1",
          },
        ]}
      />
    </SidebarProvider>,
  );

  const navigation = screen.getByRole("navigation");
  expect(
    within(navigation)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")),
  ).toEqual(["/en-GB/projects", "/en-GB/partnerships/partnership-1", null]);
  expect(within(navigation).getByTestId("back-to-projects")).toHaveAttribute(
    "href",
    "/en-GB/projects",
  );
  expect(within(navigation).getAllByRole("listitem")).toHaveLength(3);
  expect(
    container.querySelectorAll('[data-slot="breadcrumb-page"]'),
  ).toHaveLength(1);
});

it("renders only the current page when the route has no parent crumbs", () => {
  render(
    <SidebarProvider>
      <BreadcrumbTrail current="Projects" items={[]} />
    </SidebarProvider>,
  );

  const navigation = screen.getByRole("navigation");
  expect(within(navigation).getAllByRole("listitem")).toHaveLength(1);
  expect(within(navigation).queryAllByRole("link")).toHaveLength(1);
  expect(within(navigation).getAllByRole("link")[0]).not.toHaveAttribute("href");
});
