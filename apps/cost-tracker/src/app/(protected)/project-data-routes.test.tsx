import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasOrganizationMembership: vi.fn().mockResolvedValue(true),
  hydrateClient: vi.fn(
    ({ children }: { children: React.ReactNode; client: unknown }) => children,
  ),
  partnerOrganizationsQueryOptions: vi.fn(() => ({
    queryKey: ["partner-organizations", "list"],
  })),
  projectDataErrorBoundary: vi.fn(
    ({ children, resource }: { children: React.ReactNode; resource: string }) => (
      <div data-resource={resource} data-testid="project-data-error-boundary">
        {children}
      </div>
    ),
  ),
  projectsQueryOptions: vi.fn(() => ({ queryKey: ["projects", "list"] })),
  query: vi.fn().mockResolvedValue(undefined),
  swallowPrefetchError: vi.fn(),
  requireSession: vi.fn().mockResolvedValue({
    user: { name: "Cost Tracker User" },
  }),
}));

const queryClient = { query: mocks.query };

vi.mock("@/features/projects/components/dashboard-overview", () => ({
  DashboardOverview: ({ userName }: { userName: string }) => (
    <p>Dashboard for {userName}</p>
  ),
}));
vi.mock("@/features/projects/components/partner-organizations-list", () => ({
  PartnerOrganizationsList: () => <p>Partner Organizations view</p>,
}));
vi.mock("@/features/projects/components/project-data-error-boundary", () => ({
  ProjectDataErrorBoundary: mocks.projectDataErrorBoundary,
}));
vi.mock("@/features/projects/components/projects-list", () => ({
  ProjectsList: () => <p>Projects view</p>,
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: { list: { queryOptions: mocks.projectsQueryOptions } },
    partnerOrganizations: {
      list: { queryOptions: mocks.partnerOrganizationsQueryOptions },
    },
  },
}));
vi.mock("@/lib/session", () => ({
  hasOrganizationMembership: mocks.hasOrganizationMembership,
  requireSession: mocks.requireSession,
}));
vi.mock("@/lib/tanstack-react-query/hydration", () => ({
  getQueryClient: () => queryClient,
  HydrateClient: mocks.hydrateClient,
  swallowPrefetchError: mocks.swallowPrefetchError,
}));

import DashboardPage from "@/app/(protected)/dashboard/page";
import PartnerOrganizationsPage from "@/app/(protected)/partner-organizations/page";
import ProjectsPage from "@/app/(protected)/projects/page";

describe("Cost Tracker Project data routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefetches both dashboard reads before hydrating the overview", async () => {
    render(await DashboardPage());

    expect(mocks.requireSession).toHaveBeenCalledOnce();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["projects", "list"],
    });
    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partner-organizations", "list"],
    });
    expect(mocks.hydrateClient.mock.calls[0]?.[0].client).toBe(queryClient);
    expect(screen.getByText("Dashboard for Cost Tracker User")).toBeTruthy();
    expect(
      screen
        .getByTestId("project-data-error-boundary")
        .getAttribute("data-resource"),
    ).toBe("the dashboard");
  });

  it("prefetches the Project list before hydrating its view", async () => {
    render(await ProjectsPage());

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["projects", "list"],
    });
    expect(mocks.hydrateClient.mock.calls[0]?.[0].client).toBe(queryClient);
    expect(screen.getByText("Projects view")).toBeTruthy();
    expect(
      screen
        .getByTestId("project-data-error-boundary")
        .getAttribute("data-resource"),
    ).toBe("Projects");
  });

  it("prefetches Partner Organizations before hydrating their view", async () => {
    render(await PartnerOrganizationsPage());

    expect(mocks.query).toHaveBeenCalledWith({
      queryKey: ["partner-organizations", "list"],
    });
    expect(mocks.hydrateClient.mock.calls[0]?.[0].client).toBe(queryClient);
    expect(screen.getByText("Partner Organizations view")).toBeTruthy();
    expect(
      screen
        .getByTestId("project-data-error-boundary")
        .getAttribute("data-resource"),
    ).toBe("Partner Organizations");
  });
});
