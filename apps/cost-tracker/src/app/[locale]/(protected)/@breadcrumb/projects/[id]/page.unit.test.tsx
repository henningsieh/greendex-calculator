import { screen } from "@testing-library/react";
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
    projects: {
      get: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["projects", "detail", input.projectId],
        }),
      },
    },
  },
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
}));

import { SidebarProvider } from "@/components/ui/sidebar";

import { ProjectDetailsBreadcrumbContent } from "./page";

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

beforeEach(() => {
  mocks.query.mockReset();
  mocks.io.mockReset();
});

it("links to the Projects table and marks the current crumb", async () => {
  mocks.query.mockResolvedValue({ relationship: "hosted" });
  mocks.io.mockResolvedValue(undefined);

  render(
    <SidebarProvider>
      {await ProjectDetailsBreadcrumbContent({
        params: Promise.resolve({ id: "project-1" }),
      })}
    </SidebarProvider>,
  );

  expect(screen.getByTestId("back-to-projects")).toHaveAttribute(
    "href",
    "/en/projects",
  );
  expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
});
