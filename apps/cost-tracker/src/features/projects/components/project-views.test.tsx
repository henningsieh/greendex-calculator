import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PartnerOrganizationListItem,
  ProjectListItem,
} from "@/features/projects/types";

const queryResults = vi.hoisted(() => ({
  partners: [] as PartnerOrganizationListItem[],
  projects: [] as ProjectListItem[],
  projectsError: undefined as Error | undefined,
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    partnerOrganizations: {
      list: {
        queryOptions: () => ({
          queryKey: ["partner-organizations"],
          queryFn: async () => queryResults.partners,
        }),
      },
    },
    projects: {
      list: {
        queryOptions: () => ({
          queryKey: ["projects"],
          queryFn: async () => {
            if (queryResults.projectsError) {
              throw queryResults.projectsError;
            }

            return queryResults.projects;
          },
        }),
      },
    },
  },
}));

import { DashboardOverview } from "@/features/projects/components/dashboard-overview";
import { PartnerOrganizationsList } from "@/features/projects/components/partner-organizations-list";
import { ProjectDataErrorBoundary } from "@/features/projects/components/project-data-error-boundary";
import { ProjectsList } from "@/features/projects/components/projects-list";

function renderQueryView(view: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading test data</p>}>{view}</Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryResults.partners = [];
  queryResults.projects = [];
  queryResults.projectsError = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Cost Tracker Project views", () => {
  it("renders the active Organization Projects from the query contract", async () => {
    queryResults.projects = [
      {
        id: "project-1",
        name: "Community Summit",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-03T00:00:00.000Z"),
        location: "Berlin",
        costSubmissionWindowOpen: true,
        partnerOrganizationCount: 2,
      },
    ];

    renderQueryView(<ProjectsList />);

    expect(await screen.findByText("Community Summit")).toBeTruthy();
    expect(screen.getByText("Cost window open")).toBeTruthy();
    expect(screen.getByText("2 Partner Organizations")).toBeTruthy();
  });

  it("keeps the server-sorted upcoming Project order and limit", async () => {
    queryResults.projects = Array.from({ length: 6 }, (_, index) => ({
      id: `project-${index + 1}`,
      name: `Project ${index + 1}`,
      startDate: new Date(`2026-0${index + 1}-01T00:00:00.000Z`),
      endDate: new Date(`2026-0${index + 1}-03T00:00:00.000Z`),
      location: "Berlin",
      costSubmissionWindowOpen: false,
      partnerOrganizationCount: index === 0 ? 1 : 2,
    }));

    renderQueryView(<DashboardOverview userName="Alex Morgan" />);

    expect(await screen.findByRole("link", { name: "Project 1" })).toBeTruthy();
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.textContent?.startsWith("Project"))
        .map((link) => link.textContent),
    ).toEqual(["Project 1", "Project 2", "Project 3", "Project 4", "Project 5"]);
    expect(screen.queryByRole("link", { name: "Project 6" })).toBeNull();
    expect(screen.getByText("1 Partner Organization")).toBeTruthy();
    expect(screen.getAllByText("2 Partner Organizations")).toHaveLength(4);
  });

  it("presents a safe recovery UI when a generated Project query fails", async () => {
    queryResults.projectsError = new Error("network unavailable");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    renderQueryView(
      <ProjectDataErrorBoundary resource="Projects">
        <ProjectsList />
      </ProjectDataErrorBoundary>,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "We couldn't load Projects. Try again.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("renders an accessible Projects empty state", async () => {
    renderQueryView(<ProjectsList />);

    expect(
      await screen.findByRole("heading", { name: "No active Projects" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Projects for the selected Organization will appear here.",
      ),
    ).toBeTruthy();
  });

  it("renders assigned Partner Organizations and their Projects", async () => {
    queryResults.partners = [
      {
        id: "partner-1",
        name: "Mobility Cooperative",
        projectNames: ["Community Summit", "Climate Forum"],
      },
    ];

    renderQueryView(<PartnerOrganizationsList />);

    expect(await screen.findByText("Mobility Cooperative")).toBeTruthy();
    expect(screen.getByText("Community Summit, Climate Forum")).toBeTruthy();
  });

  it("renders an accessible Partner Organizations empty state", async () => {
    renderQueryView(<PartnerOrganizationsList />);

    expect(
      await screen.findByRole("heading", { name: "No Partner Organizations" }),
    ).toBeTruthy();
  });

  it("summarizes the authenticated user's active Organization", async () => {
    queryResults.projects = [
      {
        id: "project-1",
        name: "Community Summit",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-03T00:00:00.000Z"),
        location: "Berlin",
        costSubmissionWindowOpen: false,
        partnerOrganizationCount: 1,
      },
    ];
    queryResults.partners = [
      {
        id: "partner-1",
        name: "Mobility Cooperative",
        projectNames: ["Community Summit"],
      },
    ];

    renderQueryView(<DashboardOverview userName="Alex Morgan" />);

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Alex" }),
    ).toBeTruthy();
    expect(screen.getAllByText("1", { selector: "p" })).toHaveLength(2);
    expect(screen.getByText("Active Projects")).toBeTruthy();
    expect(screen.getByText("Partner Organizations")).toBeTruthy();
    expect(screen.getByText("Community Summit")).toBeTruthy();
  });
});
