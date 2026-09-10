import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  availableScopes: vi.fn(),
  getOverviewOptions: vi.fn((scope: string) => ({
    queryKey: ["projects", scope],
  })),
  hasOrganizationMembership: vi.fn().mockResolvedValue(true),
  hydrateClient: vi.fn(
    ({ children }: { children: React.ReactNode; client: unknown }) => children,
  ),
  query: vi.fn((options: { queryKey: string[] }) =>
    options.queryKey[1] === "available-scopes"
      ? mocks.availableScopes()
      : Promise.resolve(undefined),
  ),
  swallowPrefetchError: vi.fn(),
}));

const queryClient = { query: mocks.query };

vi.mock("@/features/projects/components/project-collection", () => ({
  ProjectCollection: () => <p>Project collection</p>,
}));
vi.mock("@/features/projects/components/project-partnership-manager", () => ({
  ProjectPartnershipManager: () => <p>Project Partnership manager</p>,
}));
vi.mock("@/features/projects/components/project-workspace", () => ({
  ProjectWorkspace: ({ projectId }: { projectId: string }) => (
    <p>Project workspace: {projectId}</p>
  ),
}));
vi.mock("@/features/projects/components/project-data-error-boundary", () => ({
  ProjectDataErrorBoundary: ({
    children,
    resource,
  }: {
    children: React.ReactNode;
    resource: string;
  }) => <div data-resource={resource}>{children}</div>,
}));
vi.mock("@/features/projects/project-overview-query-options", () => ({
  getProjectAvailableScopesQueryOptions: () => ({
    queryKey: ["projects", "available-scopes"],
  }),
  getProjectOverviewQueryOptions: mocks.getOverviewOptions,
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { projects: { availableScopes: mocks.availableScopes } },
  orpcQuery: {
    projects: {
      detail: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["projects", "detail", input.projectId],
        }),
      },
    },
    projectPartnerships: {
      list: { queryOptions: () => ({ queryKey: ["partnerships", "list"] }) },
    },
  },
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.hasOrganizationMembership,
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => queryClient,
  HydrateClient: mocks.hydrateClient,
  swallowPrefetchError: mocks.swallowPrefetchError,
}));

import PartnerOrganizationsPage from "@/app/(protected)/partner-organizations/page";
import ProjectPage from "@/app/(protected)/projects/[id]/page";
import ProjectsPage from "@/app/(protected)/projects/page";

describe("Cost Tracker Project data routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.availableScopes.mockResolvedValue({ hosted: true, partner: true });
  });

  it("defaults to Hosted and prefetches only the selected overview", async () => {
    render(await ProjectsPage());

    expect(mocks.availableScopes).toHaveBeenCalledOnce();
    expect(mocks.getOverviewOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ pageSize: 25, window: "all" }),
    );
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenNthCalledWith(1, {
      queryKey: ["projects", "available-scopes"],
    });
    expect(mocks.query).toHaveBeenNthCalledWith(2, {
      queryKey: ["projects", "hosted"],
    });
    expect(screen.getByText("Project collection")).toBeTruthy();
  });

  it("uses Partner when requested and available", async () => {
    render(
      await ProjectsPage({
        searchParams: Promise.resolve({ scope: "partner", window: "open" }),
      }),
    );

    expect(mocks.getOverviewOptions).toHaveBeenCalledWith(
      "partner",
      expect.objectContaining({ window: "open" }),
    );
    expect(screen.getByText("Project collection")).toBeTruthy();
  });

  it("falls back to Partner when no Hosted Projects are available", async () => {
    mocks.availableScopes.mockResolvedValue({ hosted: false, partner: true });

    render(await ProjectsPage());

    expect(screen.getByText("Project collection")).toBeTruthy();
  });

  it("prefetches Hosted Projects without a stale Partner cursor", async () => {
    mocks.availableScopes.mockResolvedValue({ hosted: true, partner: false });

    render(
      await ProjectsPage({
        searchParams: Promise.resolve({
          cursor: "partner-cursor",
          scope: "partner",
        }),
      }),
    );

    expect(mocks.getOverviewOptions).toHaveBeenCalledWith(
      "hosted",
      expect.objectContaining({ cursor: undefined }),
    );
  });

  it("prefetches Project Partnership management data", async () => {
    render(await PartnerOrganizationsPage());

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partnerships", "list"],
    });
    expect(screen.getByText("Project Partnership manager")).toBeTruthy();
  });

  it("prefetches the relationship-derived Project workspace", async () => {
    render(await ProjectPage({ params: Promise.resolve({ id: "project-1" }) }));

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["projects", "detail", "project-1"],
    });
    expect(screen.getByText("Project workspace: project-1")).toBeTruthy();
  });
});
