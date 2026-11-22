import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  detail: {} as Record<string, unknown>,
  archive: vi.fn(),
  reopen: vi.fn(),
  toastAdd: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    claims: { reviewerAccess: { key: () => ["reviewer-access"] } },
    participations: {
      listPartnership: { key: () => ["participations"] },
      get: { key: () => ["participation"] },
    },
    projectPartnerships: { listSetupLinks: { key: () => ["setup-links"] } },
    projects: {
      get: {
        queryOptions: ({ input }: { input: { projectId: string } }) => ({
          queryKey: ["project", input.projectId],
          queryFn: async () => mocks.detail,
        }),
      },
    },
  },
  orpc: { projects: { archive: mocks.archive, reopen: mocks.reopen } },
}));

vi.mock(
  "@/features/partnerships/components/partnership-actions",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/partnerships/components/partnership-actions")
    >()),
    PartnershipActions: ({ projectId }: { projectId?: string }) => (
      <p data-project-id={projectId} data-testid="partnership-actions" />
    ),
    PartnershipShortcutLinks: ({ projectId }: { projectId?: string }) => (
      <p data-project-id={projectId} data-testid="invite-partnership-link" />
    ),
  }),
);
vi.mock("@/features/partnerships/components/invalidate-partnership-data", () => ({
  invalidatePartnershipProjectData: (queryClient: QueryClient) =>
    queryClient.invalidateQueries({ queryKey: ["project"] }),
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
  participantCount: 3,
  daysLeft: 5,
};

function renderWorkspace({
  canManagePartnerships = false,
  canReopen = false,
} = {}) {
  mocks.detail.canReopen = canReopen;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p>Loading workspace</p>}>
        <ProjectWorkspace
          canManagePartnerships={canManagePartnerships}
          projectId="project-1"
        />
      </Suspense>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.detail = {};
  mocks.archive.mockReset();
  mocks.reopen.mockReset();
  mocks.toastAdd.mockReset();
});

describe("Project workspace", () => {
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
    expect(
      screen.getByRole("heading", { level: 1 }).previousElementSibling,
    ).toHaveClass("type-ember-eyebrow");
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
    expect(screen.queryByTestId("manage-project-partnerships")).toBeNull();
    expect(screen.getByTestId("stat-open-claims")).toBeInTheDocument();
    expect(screen.getByTestId("stat-partners")).toBeInTheDocument();
    expect(screen.getByTestId("stat-participants")).toBeInTheDocument();
    // Without a reviewable Claim there is no review link at all: the badge
    // already carries the state, so an inert duplicate would only pretend
    // at navigation to a page that has nothing to review.
    expect(screen.queryByTestId("review-claim-partnership-1")).toBeNull();
    expect(screen.queryByTestId("coordinate-participants")).toBeNull();
    expect(
      within(screen.getByTestId("project-facts")).getByTestId(
        "hosted-participants",
      ),
    ).toHaveAttribute("href", "/en-GB/projects/project-1/participants");
    expect(
      within(partnerships[0]!).getByTestId(
        "partnership-participations-partnership-1",
      ),
    ).toHaveAttribute("href", "/en-GB/partnerships/partnership-1/participants");
    expect(screen.queryByTestId("open-claim-workspace")).not.toBeInTheDocument();
  });

  it("holds all stats in loading until the complete shape arrives", async () => {
    // A stale cached response can carry partnerOrganizations (long-standing)
    // without the newer scalar fields. The strip must never render two
    // numbers while the third is still missing.
    const {
      participantCount: _dropped,
      daysLeft: _alsoDropped,
      ...oldShape
    } = baseProject;
    mocks.detail = {
      ...oldShape,
      relationship: "hosted",
      partnerOrganizations: [
        {
          id: "partnership-1",
          organizationName: "Mobility Group",
          claimStatus: null,
          assignedAt: new Date("2026-05-01T10:00:00.000Z"),
        },
      ],
    };
    renderWorkspace();
    await screen.findByTestId("stats-loading");
    expect(screen.queryByTestId("stat-open-claims")).toBeNull();
    expect(screen.queryByTestId("stat-partners")).toBeNull();
    expect(screen.queryByTestId("stat-participants")).toBeNull();
  });

  it("offers the partnership dialogs with the Project locked to this page", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [],
    };
    renderWorkspace({ canManagePartnerships: true });
    expect(await screen.findByTestId("partnership-actions")).toHaveAttribute(
      "data-project-id",
      "project-1",
    );
    // The empty state links into the same dialog instead of navigating away.
    expect(screen.getByTestId("invite-partnership-link")).toHaveAttribute(
      "data-project-id",
      "project-1",
    );
    expect(screen.getByTestId("partnership-shortcut-intro")).toBeInTheDocument();
  });

  it("hides the partnership dialogs without the management permission", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      partnerOrganizations: [],
    };
    renderWorkspace();
    await screen.findByTestId("project-workspace");
    expect(screen.queryByTestId("partnership-actions")).toBeNull();
    expect(screen.getByTestId("assigned-partnerships-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("partnership-shortcut-intro")).toBeNull();
    expect(screen.queryByTestId("invite-partnership-link")).toBeNull();
  });

  it("hides empty-state shortcuts for an archived Project", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      archived: true,
      partnerOrganizations: [],
    };
    renderWorkspace({ canManagePartnerships: true });
    expect(
      await screen.findByTestId("assigned-partnerships-empty"),
    ).toBeInTheDocument();
    const header = screen.getByRole("heading", { level: 1 }).closest("header");
    expect(header).toContainElement(
      screen.getByTestId("project-archived-status"),
    );
    expect(screen.queryByTestId("partnership-shortcut-intro")).toBeNull();
    expect(screen.queryByTestId("invite-partnership-link")).toBeNull();
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
        ["New Claim", "in_preparation"],
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
      ["partnership-6", "in_preparation"],
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
    // A Claim that exists links to its review page, which hangs under this
    // Hosted Project in the breadcrumb.
    expect(
      screen.getByTestId("review-claim-partnership-4").getAttribute("href"),
    ).toBe("/en-GB/partnerships/partnership-4/claim/review");
    // Unreviewable Claims (none yet, or still an unsubmitted Partner draft)
    // have no review page and therefore no review link; every status from
    // submission onwards links to its review, terminal ones read-only.
    expect(screen.queryByTestId("review-claim-partnership-5")).toBeNull();
    expect(screen.queryByTestId("review-claim-partnership-6")).toBeNull();
    for (const id of [
      "partnership-0",
      "partnership-1",
      "partnership-2",
      "partnership-3",
    ]) {
      expect(screen.getByTestId(`review-claim-${id}`).getAttribute("href")).toBe(
        `/en-GB/partnerships/${id}/claim/review`,
      );
    }
    // Only `submitted` awaits a Hosting decision: a correction request reopens
    // Partner editing, and every other status is decided or unsubmitted.
    expect(screen.getByTestId("stat-open-claims")).toHaveAttribute(
      "data-value",
      "1",
    );
  });

  it("confirms archive before changing an eligible Hosted Project", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      canArchive: true,
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
    mocks.archive.mockImplementation(async () => {
      mocks.detail = {
        ...mocks.detail,
        archived: true,
      };
      return { projectId: "project-1", archived: true };
    });
    renderWorkspace();
    await user.click(await screen.findByTestId("archive-project"));
    await user.click(await screen.findByTestId("confirm-dialog-cancel"));
    expect(mocks.archive).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("archive-project"));
    await user.click(await screen.findByTestId("confirm-dialog-execute"));
    expect(mocks.archive).toHaveBeenCalledWith({ projectId: "project-1" });
    expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "success" }),
    );
    expect(screen.queryByTestId("archive-project")).toBeNull();
  });

  it("hides completion for blocked, completed and Partner Projects", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      canArchive: true,
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
    expect(screen.queryByTestId("archive-project")).toBeNull();
  });

  it("hides archive for a settled Hosted Project without archive capability", async () => {
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      canArchive: false,
      partnerOrganizations: [],
    };
    renderWorkspace();
    expect(await screen.findByTestId("project-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("archive-project")).toBeNull();
  });

  it("requires a reason to reopen an archived Project", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      archived: true,
      partnerOrganizations: [],
    };
    mocks.reopen.mockImplementation(async () => {
      mocks.detail = { ...mocks.detail, archived: false };
    });
    renderWorkspace({ canReopen: true });
    await user.click(await screen.findByTestId("reopen-project"));
    const reason = screen.getByRole("textbox");
    await user.type(reason, "Correct a payment");
    await user.click(screen.getByTestId("reopen-project-confirm"));
    expect(mocks.reopen).toHaveBeenCalledWith({
      projectId: "project-1",
      reason: "Correct a payment",
    });
  });

  it.each(["FORBIDDEN", "NOT_FOUND"] as const)(
    "disables reopening after %s refresh removes capability",
    async (code) => {
      const user = userEvent.setup();
      mocks.detail = {
        ...baseProject,
        relationship: "hosted",
        archived: true,
        partnerOrganizations: [],
      };
      mocks.reopen.mockImplementation(async () => {
        mocks.detail = { ...mocks.detail, canReopen: false };
        throw new ORPCError(code);
      });
      renderWorkspace({ canReopen: true });
      await user.click(await screen.findByTestId("reopen-project"));
      await user.type(screen.getByRole("textbox"), "Correction");
      await user.click(screen.getByTestId("reopen-project-confirm"));
      await waitFor(() =>
        expect(screen.getByTestId("reopen-project-confirm")).toBeDisabled(),
      );
      await user.click(screen.getByTestId("reopen-project-confirm"));
      expect(mocks.reopen).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("reopen-project")).toBeNull();
    },
  );

  it("keeps reopening retryable without refreshing on network errors", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      archived: true,
      partnerOrganizations: [],
    };
    mocks.reopen.mockImplementation(async () => {
      mocks.detail = { ...mocks.detail, canReopen: false };
      throw new Error("Network unavailable");
    });
    renderWorkspace({ canReopen: true });
    await user.click(await screen.findByTestId("reopen-project"));
    await user.type(screen.getByRole("textbox"), "Correction");
    await user.click(screen.getByTestId("reopen-project-confirm"));
    await waitFor(() => expect(mocks.toastAdd).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox")).toHaveValue("Correction");
    expect(screen.getByTestId("reopen-project-confirm")).toBeEnabled();
    await user.click(screen.getByTestId("reopen-project-confirm"));
    expect(mocks.reopen).toHaveBeenCalledTimes(2);
  });

  it("keeps archived Partnership actions visible with a keyboard-accessible explanation", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      archived: true,
      partnerOrganizations: [],
    };
    renderWorkspace({ canManagePartnerships: true });
    const trigger = await screen.findByTestId("archive-explanation-trigger");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByTestId("archive-explanation-content"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("project-workspace").querySelectorAll("button:disabled")
        .length,
    ).toBe(0);
  });

  it("reports an archive failure without marking the Project archived", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      canArchive: true,
      completedAt: null,
      partnerOrganizations: [],
    };
    mocks.archive.mockRejectedValue(new Error("network"));
    renderWorkspace();
    await user.click(await screen.findByTestId("archive-project"));
    await user.click(await screen.findByTestId("confirm-dialog-execute"));
    expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "error" }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("confirm-dialog-execute")).toBeEnabled();
    });
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it.each(["FORBIDDEN", "NOT_FOUND"] as const)(
    "refreshes lifecycle availability on %s",
    async (code) => {
      const user = userEvent.setup();
      mocks.detail = {
        ...baseProject,
        relationship: "hosted",
        canArchive: true,
        completedAt: null,
        partnerOrganizations: [],
      };
      mocks.archive.mockImplementation(async () => {
        mocks.detail = { ...mocks.detail, canArchive: false };
        throw new ORPCError(code);
      });
      renderWorkspace();
      await user.click(await screen.findByTestId("archive-project"));
      await user.click(await screen.findByTestId("confirm-dialog-execute"));
      await waitFor(() =>
        expect(screen.queryByTestId("archive-project")).toBeNull(),
      );
    },
  );

  it("does not refresh lifecycle availability on a network error", async () => {
    const user = userEvent.setup();
    mocks.detail = {
      ...baseProject,
      relationship: "hosted",
      canArchive: true,
      completedAt: null,
      partnerOrganizations: [],
    };
    mocks.archive.mockImplementation(async () => {
      mocks.detail = { ...mocks.detail, canArchive: false };
      throw new Error("Network unavailable");
    });
    renderWorkspace();
    await user.click(await screen.findByTestId("archive-project"));
    await user.click(await screen.findByTestId("confirm-dialog-execute"));
    await waitFor(() => expect(mocks.toastAdd).toHaveBeenCalled());
    expect(screen.getByTestId("archive-project")).toBeInTheDocument();
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
      within(screen.getByTestId("project-facts"))
        .getByTestId("coordinate-participants")
        .getAttribute("href"),
    ).toBe("/en-GB/partnerships/partnership-1/participants");
    expect(screen.getByTestId("open-claim-workspace").getAttribute("href")).toBe(
      "/en-GB/partnerships/partnership-1/claim",
    );
    expect(screen.queryByTestId("hosted-participants")).toBeNull();
    expect(screen.queryByTestId("archive-project")).toBeNull();
  });
});
