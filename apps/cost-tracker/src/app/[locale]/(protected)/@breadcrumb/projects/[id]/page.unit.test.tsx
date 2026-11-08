import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@greendex/i18n/server", async () => ({
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

async function renderSlot(searchParams: Record<string, string>) {
  render(
    <SidebarProvider>
      {await ProjectDetailsBreadcrumbContent({
        params: Promise.resolve({ id: "project-1" }),
        searchParams: Promise.resolve(searchParams),
      })}
    </SidebarProvider>,
  );
}

it("returns to the filtered Project list that linked here", async () => {
  mocks.query.mockResolvedValue({ relationship: "hosted" });

  await renderSlot({
    returnTo: "/projects?scope=partner&search=climate&cursor=opaque",
  });

  expect(screen.getByTestId("back-to-projects")).toHaveAttribute(
    "href",
    "/projects?scope=partner&search=climate&cursor=opaque",
  );
  // The slot must defer its clock reads (TanStack stamp + Better Auth) to
  // request time before touching the query.
  expect(mocks.io).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { current: "page" })).not.toHaveAttribute(
    "href",
  );
});

it("falls back to the bare Project list for an unsafe return destination", async () => {
  mocks.query.mockResolvedValue({ relationship: "partner" });

  await renderSlot({ returnTo: "https://attacker.example/projects" });

  expect(screen.getByTestId("back-to-projects")).toHaveAttribute(
    "href",
    "/projects",
  );
  expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
});
