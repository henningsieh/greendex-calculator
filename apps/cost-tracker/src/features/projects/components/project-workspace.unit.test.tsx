import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
  complete: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      get: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["project", input.projectId],
          queryFn: async () => mocks.detail,
        }),
      },
    },
  },
  orpc: { projects: { complete: mocks.complete } },
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
  mocks.complete.mockReset();
});

describe("Project workspace", () => {
  it("returns to the exact Project list URL", async () => {
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
          claimStatus: null,
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
    expect(
      screen.queryByRole("link", { name: "Coordinate Participants" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Hosting Participant view" })
        .getAttribute("href"),
    ).toBe("/projects/project-1/participants");
    expect(screen.queryByText(/Cost Submission$/)).toBeNull();
  });

  it("renders each hosted Partnership's derived readiness independently", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [
        ["Mobility Group", "correction_requested"],
        ["Civic Union", "approved"],
        ["Green Society", "paid"],
        ["Arts Circle", "rejected"],
        ["Future Collective", "submitted"],
        ["Open Partnership", null],
        ["New Claim", "editable"],
      ].map(([organizationName, claimStatus], index) => ({
        id: `partnership-${index}`,
        organizationName,
        claimStatus,
        assignedAt: new Date("2026-05-01T10:00:00.000Z"),
      })),
    };
    renderWorkspace();
    await screen.findByText("Mobility Group");
    for (const [name, status] of [
      ["Mobility Group", "Correction requested"],
      ["Civic Union", "Approved · unpaid"],
      ["Green Society", "Paid"],
      ["Arts Circle", "Rejected"],
      ["Future Collective", "Submitted"],
      ["Open Partnership", "No Claim"],
      ["New Claim", "Active Claim · editable"],
    ]) {
      expect(
        within(screen.getByText(name).closest("li")!).getByText(status),
      ).toBeTruthy();
    }
  });

  it("completes an eligible Hosted Project and refreshes its workspace", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      completedAt: null,
      completedByUserId: null,
      partnerOrganizations: [
        {
          id: "link-1",
          organizationName: "Partner",
          claimStatus: "paid",
          assignedAt: new Date(),
        },
      ],
    };
    mocks.complete.mockResolvedValue({ projectId: "project-1", completed: true });
    renderWorkspace();
    await user.click(
      await screen.findByRole("button", { name: "Complete Project" }),
    );
    expect(mocks.complete).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(await screen.findByText("Project completed.")).toBeTruthy();
  });

  it("hides completion for blocked, completed and Partner Projects", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      completedAt: null,
      partnerOrganizations: [
        {
          id: "link-1",
          organizationName: "Partner",
          claimStatus: "submitted",
          assignedAt: new Date(),
        },
      ],
    };
    renderWorkspace();
    await screen.findByText("Partner");
    expect(screen.queryByRole("button", { name: "Complete Project" })).toBeNull();
  });

  it("shows recorded completion and no repeat action", async () => {
    const completedAt = new Date("2026-06-05T12:00:00.000Z");
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      completedAt,
      completedByUserId: "staff-1",
      partnerOrganizations: [],
    };
    renderWorkspace();
    expect(await screen.findByText("Completed")).toBeTruthy();
    expect(screen.getByText(/Completed 5 Jun 2026.*staff-1/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete Project" })).toBeNull();
  });

  it("reports a completion failure without marking the Project completed", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      completedAt: null,
      partnerOrganizations: [],
    };
    mocks.complete.mockRejectedValue(new Error("network"));
    renderWorkspace();
    await user.click(
      await screen.findByRole("button", { name: "Complete Project" }),
    );
    expect(
      await screen.findByText(/server or network is unreachable/i),
    ).toBeTruthy();
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("renders only the active Partner assignment and Hosting identity", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "partner",
      hostingOrganization: { id: "host-1", name: "Hosting Group" },
      partnership: {
        id: "partnership-1",
        claimStatus: "submitted",
        assignedAt: new Date("2026-05-01T10:00:00.000Z"),
        updatedAt: new Date("2026-05-02T10:00:00.000Z"),
      },
    };
    renderWorkspace();

    expect(await screen.findByText("Hosting Group")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.queryByText("Assigned Partner Organizations")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Coordinate Participants" })
        .getAttribute("href"),
    ).toBe("/partnerships/partnership-1/participants");
    expect(
      screen
        .getByRole("link", { name: "Open Claim workspace" })
        .getAttribute("href"),
    ).toBe("/partnerships/partnership-1/claim");
    // A Partner Project row keeps its Partnership workspace and is never sent
    // to the Hosting-only Hosting Participant view it cannot read.
    expect(
      screen.queryByRole("link", { name: "Hosting Participant view" }),
    ).toBeNull();
    expect(screen.queryByText(/EUR|Proof Document/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete Project" })).toBeNull();
  });
});
