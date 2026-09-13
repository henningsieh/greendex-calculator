import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      detail: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["project", input.projectId, mocks.detail],
          queryFn: async () => mocks.detail,
        }),
      },
    },
  },
}));

import { ProjectWorkspace } from "@/features/projects/components/project-workspace";

const baseProject = {
  id: "project-1",
  name: "Climate Forum",
  startDate: new Date("2026-06-01T00:00:00.000Z"),
  endDate: new Date("2026-06-03T00:00:00.000Z"),
  location: "Berlin",
  country: "DE",
  archived: false,
  costSubmissionWindowOpen: true,
};

function renderWorkspace(returnTo?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading workspace</p>}>
        <ProjectWorkspace projectId="project-1" returnTo={returnTo} />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.detail = {};
});

describe("Project workspace", () => {
  it("returns to the exact Project collection URL", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [],
    };
    renderWorkspace("/projects?scope=partner&search=climate&cursor=opaque");

    expect(
      (
        await screen.findByRole("link", { name: "Back to Projects" })
      ).getAttribute("href"),
    ).toBe("/projects?scope=partner&search=climate&cursor=opaque");
  });

  it("falls back to Projects for an unsafe return destination", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [],
    };
    renderWorkspace("https://attacker.example/projects");

    expect(
      (
        await screen.findByRole("link", { name: "Back to Projects" })
      ).getAttribute("href"),
    ).toBe("/projects");
  });

  it("renders the Hosted-safe shell and management navigation", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [
        {
          id: "partnership-1",
          organizationId: "partner-1",
          organizationName: "Mobility Group",
          assignedAt: new Date("2026-05-01T10:00:00.000Z"),
          updatedAt: new Date("2026-05-01T10:00:00.000Z"),
        },
      ],
    };
    renderWorkspace();

    expect(await screen.findByText("Climate Forum")).toBeTruthy();
    expect(screen.getByText("Mobility Group")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Manage Project Partnerships" })
        .getAttribute("href"),
    ).toBe("/partner-organizations");
    expect(screen.queryByText(/Cost Submission$/)).toBeNull();
  });

  it("renders only the active Partner assignment and Hosting identity", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "partner",
      hostingOrganization: { id: "host-1", name: "Hosting Group" },
      partnership: {
        id: "partnership-1",
        assignedAt: new Date("2026-05-01T10:00:00.000Z"),
        updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      },
    };
    renderWorkspace();

    expect(await screen.findByText("Hosting Group")).toBeTruthy();
    expect(screen.queryByText("Assigned Partner Organizations")).toBeNull();
    expect(screen.queryByText(/EUR|Proof Document|Participant/i)).toBeNull();
  });
});
