// @vitest-environment node

import { PassThrough } from "node:stream";

import { renderToPipeableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  resolveScopes: undefined as
    | undefined
    | ((value: { hosted: boolean; partner: boolean }) => void),
  query: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: async () => true,
}));
vi.mock("@/features/projects/components/project-list", () => ({
  ProjectList: () => <p>Hydrated Project list</p>,
}));
vi.mock("@/features/projects/components/project-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/features/projects/project-list-query-options", () => ({
  getProjectAvailableScopesQueryOptions: () => ({ queryKey: ["scopes"] }),
  getProjectListQueryOptions: () => ({ queryKey: ["list"] }),
  loadProjectListSearchParams: async () => ({}),
  normalizeProjectListState: () => ({}),
  resolveProjectListState: () => ({ scope: "hosted", state: {} }),
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
  HydrateClient: ({ children }: { children: React.ReactNode }) => children,
  swallowPrefetchError: vi.fn(),
}));

import ProjectsPage from "@/app/(protected)/projects/page";

it("streams the Projects header and list fallback before scope prefetch finishes", async () => {
  const scopes = new Promise<{ hosted: boolean; partner: boolean }>((resolve) => {
    mocks.resolveScopes = resolve;
  });
  mocks.query.mockImplementation(({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "scopes" ? scopes : Promise.resolve({}),
  );

  const destination = new PassThrough();
  let html = "";
  destination.setEncoding("utf8");
  const shell = new Promise<void>((resolve) => {
    destination.on("data", (chunk: string) => {
      html += chunk;
      if (html.includes("Loading Project list")) resolve();
    });
  });
  const complete = new Promise<void>((resolve) => destination.on("end", resolve));
  const { pipe } = renderToPipeableStream(
    <ProjectsPage searchParams={Promise.resolve({})} />,
    { onShellReady: () => pipe(destination) },
  );

  await shell;
  expect(html).toContain("Project workspace");
  expect(html).toContain("Loading Project list");
  expect(html).not.toContain("Hydrated Project list");
  mocks.resolveScopes?.({ hosted: true, partner: false });
  await complete;
  expect(html).toContain("Hydrated Project list");
  expect(mocks.query).toHaveBeenCalledTimes(2);
});
