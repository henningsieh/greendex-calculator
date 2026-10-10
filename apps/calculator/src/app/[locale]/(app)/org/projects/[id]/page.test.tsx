// @vitest-environment node
import { ORPCError } from "@orpc/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  query: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@greendex/i18n/server", () => ({ getLocale: async () => "de" }));
vi.mock("@/lib/i18n/routing", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { projects: { getById: mocks.get } },
  orpcQuery: {
    projects: {
      getById: { queryOptions: () => ({ queryKey: ["project"] }) },
      getParticipants: { queryOptions: () => ({ queryKey: ["participants"] }) },
    },
    projectSharedTravelLegs: {
      list: { queryOptions: () => ({ queryKey: ["legs"] }) },
    },
  },
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => ({ query: mocks.query }),
  swallowPrefetchError: () => {},
}));
vi.mock("@/features/projects/components/project-details", () => ({
  ProjectDetailsHeader: () => null,
  ProjectDetailsSkeleton: () => null,
  ProjectDetails: () => null,
}));
vi.mock("@/features/projects/components/project-error-fallback", () => ({
  ErrorFallback: () => null,
}));
vi.mock("@/components/page-header", () => ({ PageHeader: () => null }));
vi.mock("@/components/content-container", () => ({
  ContentContainer: () => null,
}));
import { PROJECTS_PATH } from "@/app/routes";

import Page from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({});
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});

describe("Coordinator Project page safe result", () => {
  it("redirects defined UNAUTHORIZED to the same localized projects list before prefetch", async () => {
    mocks.get.mockRejectedValue(
      Object.assign(new ORPCError("UNAUTHORIZED"), { defined: true }),
    );
    await expect(
      Page({ params: Promise.resolve({ id: "project" }) }),
    ).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith({
      href: PROJECTS_PATH,
      locale: "de",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    Object.assign(new ORPCError("FORBIDDEN"), { defined: true }),
    new ORPCError("UNAUTHORIZED"),
    new Error("network"),
  ])("continues rendering/prefetch for other results: %j", async (error) => {
    if (error) mocks.get.mockRejectedValue(error);
    else mocks.get.mockResolvedValue({ id: "project" });
    await expect(
      Page({ params: Promise.resolve({ id: "project" }) }),
    ).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });
});

afterAll(() => {
  vi.doUnmock("@greendex/i18n/server");
  vi.doUnmock("@/lib/i18n/routing");
  vi.doUnmock("@/lib/orpc/orpc");
  vi.doUnmock("@/lib/tanstack-react-query/hydration");
  vi.doUnmock("@/features/projects/components/project-details");
  vi.doUnmock("@/features/projects/components/project-error-fallback");
  vi.doUnmock("@/components/page-header");
  vi.doUnmock("@/components/content-container");
  vi.resetModules();
});
