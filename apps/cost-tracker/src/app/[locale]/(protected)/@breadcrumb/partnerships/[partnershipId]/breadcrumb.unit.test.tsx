import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

vi.mock("@greendex/i18n/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@greendex/i18n/server")>()),
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  io: vi.fn(),
}));

vi.mock("next/cache", () => ({ io: mocks.io }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projectPartnerships: {
      getScope: {
        queryOptions: ({ input }: { input: { partnershipId: string } }) => ({
          queryKey: ["projectPartnerships", "scope", input.partnershipId],
        }),
      },
    },
  },
}));
vi.mock("@/lib/orpc/presentation-refusal", () => ({
  isPresentationRefusal: () => true,
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
}));

import { SidebarProvider } from "@/components/ui/sidebar";

import { ClaimWorkspaceBreadcrumbContent } from "./claim/page";
import { PartnershipParticipantsBreadcrumbContent } from "./participants/page";

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

const params = Promise.resolve({ partnershipId: "partnership-1" });

function hrefs() {
  return within(screen.getByRole("navigation"))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

function crumbCount() {
  return within(screen.getByRole("navigation")).getAllByRole("listitem").length;
}

function currentCount(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="breadcrumb-page"]').length;
}

beforeEach(() => {
  mocks.query.mockReset();
  mocks.io.mockReset();
  mocks.query.mockResolvedValue({ projectId: "project-1" });
  mocks.io.mockResolvedValue(undefined);
});

it("links Participants through the Partner Project", async () => {
  const { container } = render(
    <SidebarProvider>
      {await PartnershipParticipantsBreadcrumbContent({ params })}
    </SidebarProvider>,
  );

  // The middle crumb resolves the scope to the project, not the partnership.
  expect(hrefs()).toEqual(["/en-GB/projects", "/en-GB/projects/project-1", null]);
  expect(crumbCount()).toBe(3);
  expect(currentCount(container)).toBe(1);
});

it("links the Claim workspace through the Partner Project", async () => {
  const { container } = render(
    <SidebarProvider>
      {await ClaimWorkspaceBreadcrumbContent({ params })}
    </SidebarProvider>,
  );

  expect(hrefs()).toEqual(["/en-GB/projects", "/en-GB/projects/project-1", null]);
  expect(crumbCount()).toBe(3);
  expect(currentCount(container)).toBe(1);
});

it("degrades to the Projects crumb when the scope is refused", async () => {
  mocks.query.mockRejectedValue(new Error("refused"));

  const { container } = render(
    <SidebarProvider>
      {await PartnershipParticipantsBreadcrumbContent({ params })}
    </SidebarProvider>,
  );

  expect(hrefs()).toEqual(["/en-GB/projects", null]);
  expect(crumbCount()).toBe(2);
  expect(currentCount(container)).toBe(1);
});
