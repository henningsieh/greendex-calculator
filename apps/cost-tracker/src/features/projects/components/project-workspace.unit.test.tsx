import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

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
      (await screen.findByTestId("back-to-projects")).getAttribute("href"),
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
      (await screen.findByTestId("back-to-projects")).getAttribute("href"),
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

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId("project-workspace")).toHaveAttribute(
      "data-project-id",
      "project-1",
    );
    const partnerships = within(
      screen.getByTestId("assigned-partner-organizations"),
    ).getAllByRole("listitem");
    expect(partnerships).toHaveLength(1);
    expect(partnerships[0]).toHaveAttribute(
      "data-partnership-id",
      "partnership-1",
    );
    expect(partnerships[0]).toHaveAttribute("data-organization-id", "partner-1");
    expect(
      screen.getByTestId("manage-project-partnerships").getAttribute("href"),
    ).toBe("/partner-organizations");
    expect(screen.queryByTestId("coordinate-participants")).toBeNull();
    expect(screen.getByTestId("hosted-participants").getAttribute("href")).toBe(
      "/projects/project-1/participants",
    );
    expect(screen.queryByTestId("open-claim-workspace")).not.toBeInTheDocument();
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
    const partnerships = within(
      await screen.findByTestId("assigned-partner-organizations"),
    ).getAllByRole("listitem");
    expect(partnerships).toHaveLength(7);
    for (const [id, status] of [
      ["partnership-0", "correction_requested"],
      ["partnership-1", "approved"],
      ["partnership-2", "paid"],
      ["partnership-3", "rejected"],
      ["partnership-4", "submitted"],
      ["partnership-5", "none"],
      ["partnership-6", "editable"],
    ]) {
      const partnership = partnerships.find(
        (row) => row.getAttribute("data-partnership-id") === id,
      );
      expect(partnership).toBeInTheDocument();
      expect(partnership?.querySelector("[data-claim-status]")).toHaveAttribute(
        "data-claim-status",
        status,
      );
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
    mocks.complete.mockImplementation(async () => {
      mocks.detail = {
        ...mocks.detail,
        completedAt: new Date("2026-06-05T12:00:00.000Z"),
        completedByUserId: "staff-1",
      };
      return { projectId: "project-1", completed: true };
    });
    renderWorkspace();
    await user.click(await screen.findByTestId("complete-project"));
    expect(mocks.complete).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(await screen.findByTestId("project-feedback")).toBeInTheDocument();
    expect(await screen.findByTestId("project-completed")).toBeInTheDocument();
    expect(screen.queryByTestId("complete-project")).toBeNull();
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
    expect(
      within(
        await screen.findByTestId("assigned-partner-organizations"),
      ).getAllByRole("listitem"),
    ).toHaveLength(1);
    expect(screen.queryByTestId("complete-project")).toBeNull();
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
    expect(await screen.findByTestId("project-completed")).toBeInTheDocument();
    const completion = screen
      .getByTestId("project-workspace")
      .querySelector("[data-completed-at]");
    expect(completion).toHaveAttribute(
      "data-completed-at",
      "2026-06-05T12:00:00.000Z",
    );
    expect(completion).toHaveAttribute("data-completed-by-user-id", "staff-1");
    expect(screen.queryByTestId("complete-project")).toBeNull();
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
    await user.click(await screen.findByTestId("complete-project"));
    expect(await screen.findByTestId("project-feedback")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("complete-project")).toBeEnabled();
    });
    expect(screen.queryByTestId("project-completed")).not.toBeInTheDocument();
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

    expect(await screen.findByTestId("hosting-organization")).toHaveAttribute(
      "data-organization-id",
      "host-1",
    );
    expect(
      screen
        .getByTestId("project-workspace")
        .querySelector("[data-claim-status]"),
    ).toHaveAttribute("data-claim-status", "submitted");
    expect(
      screen.queryByTestId("assigned-partner-organizations"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("coordinate-participants").getAttribute("href"),
    ).toBe("/partnerships/partnership-1/participants");
    expect(screen.getByTestId("open-claim-workspace").getAttribute("href")).toBe(
      "/partnerships/partnership-1/claim",
    );
    expect(screen.queryByTestId("hosted-participants")).toBeNull();
    expect(screen.queryByTestId("complete-project")).toBeNull();
  });
});
