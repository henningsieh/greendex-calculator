import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  confirm: vi.fn(() => true),
  list: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/orpc/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/orpc/orpc")>();

  return {
    ...original,
    orpc: {
      projectPartnerships: {
        assign: mocks.assign,
        remove: mocks.remove,
      },
    },
    orpcQuery: {
      projects: original.orpcQuery.projects,
      projectPartnerships: {
        list: {
          queryKey: () => original.orpcQuery.projectPartnerships.list.queryKey(),
          queryOptions: (
            ...args: Parameters<
              typeof original.orpcQuery.projectPartnerships.list.queryOptions
            >
          ) => ({
            ...original.orpcQuery.projectPartnerships.list.queryOptions(...args),
            queryFn: mocks.list,
          }),
        },
      },
    },
  };
});

import { ProjectPartnershipManager } from "@/features/projects/components/project-partnership-manager";
import { orpcQuery } from "@/lib/orpc/orpc";

type Partnership = {
  id: string;
  projectId: string;
  projectName: string;
  organizationId: string;
  organizationName: string;
  assignedAt: Date;
  updatedAt: Date;
};

const existingPartnership: Partnership = {
  id: "partnership-existing",
  projectId: "project-existing",
  projectName: "Existing Project",
  organizationId: "organization-existing",
  organizationName: "Existing Partner Organization",
  assignedAt: new Date("2026-02-01T12:00:00.000Z"),
  updatedAt: new Date("2026-02-01T12:00:00.000Z"),
};
const assignedPartnership: Partnership = {
  id: "partnership-assigned",
  projectId: "project-new",
  projectName: "New Project",
  organizationId: "organization-new",
  organizationName: "New Partner Organization",
  assignedAt: new Date("2026-02-02T12:00:00.000Z"),
  updatedAt: new Date("2026-02-02T12:00:00.000Z"),
};

async function renderManager(partnerships: Partnership[]) {
  const queryClient = createQueryClient();
  await queryClient.query(
    orpcQuery.projectPartnerships.list.queryOptions({
      meta: { costTrackerORPC: true },
    }),
  );
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <ProjectPartnershipManager />
    </QueryClientProvider>,
  );

  await screen.findByText(partnerships[0]?.organizationName ?? "");
  return { invalidateQueries, queryClient };
}

function expectProjectDataInvalidation(
  invalidateQueries: ReturnType<typeof vi.fn>,
) {
  // Red if any generated Project query family is removed from invalidateProjectData.
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projectPartnerships.list.queryKey(),
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projects.hostedOverview.key({ type: "query" }),
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projects.partnerOverview.key({ type: "query" }),
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projects.detail.key({ type: "query" }),
  });
}

describe("ProjectPartnershipManager", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", mocks.confirm);
    mocks.assign.mockReset().mockResolvedValue(assignedPartnership);
    mocks.confirm.mockClear();
    mocks.list.mockReset();
    mocks.remove
      .mockReset()
      .mockResolvedValue({ id: existingPartnership.id, removed: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("invalidates generated Project query families and refreshes the visible list after assignment", async () => {
    mocks.list
      .mockResolvedValueOnce([existingPartnership])
      .mockResolvedValueOnce([assignedPartnership]);
    const user = userEvent.setup();
    const { invalidateQueries } = await renderManager([existingPartnership]);

    await user.type(
      screen.getByLabelText("Hosted Project ID"),
      assignedPartnership.projectId,
    );
    await user.type(
      screen.getByLabelText("Partner Organization ID"),
      assignedPartnership.organizationId,
    );
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith({
        organizationId: assignedPartnership.organizationId,
        projectId: assignedPartnership.projectId,
      });
    });
    await screen.findByText("New Partner Organization");
    // Red if the list query is not invalidated and refetched after a successful assign.
    expect(screen.queryByText("Existing Partner Organization")).toBeNull();
    expectProjectDataInvalidation(invalidateQueries);
  });

  it("invalidates generated Project query families and refreshes the visible list after removal", async () => {
    mocks.list
      .mockResolvedValueOnce([existingPartnership])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    const { invalidateQueries } = await renderManager([existingPartnership]);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      // Red if remove succeeds without invalidating the active list query.
      expect(
        screen.getByText(
          "No Partner Organizations are assigned to hosted Projects.",
        ),
      ).toBeTruthy();
    });
    expectProjectDataInvalidation(invalidateQueries);
  });
});
