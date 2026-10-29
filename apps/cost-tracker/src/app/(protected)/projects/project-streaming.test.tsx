// @vitest-environment node

import { PassThrough } from "node:stream";

import { NextIntlClientProvider } from "next-intl";
import { renderToPipeableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { messages } from "@/__tests__/i18n";

vi.mock("@greendex/i18n/server", async () => ({
  getTranslations: (await import("@/__tests__/i18n")).getTranslations,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  connection: () => Promise.resolve(),
}));

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
vi.mock("@/components/query-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/features/projects/list-query-options", () => ({
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
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <div>
        <ProjectsPage searchParams={Promise.resolve({})} />
      </div>
    </NextIntlClientProvider>,
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
