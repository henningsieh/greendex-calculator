import { ORPCError } from "@orpc/client";
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
  searchHosted: vi.fn(),
  searchOrganizations: vi.fn(),
}));

vi.mock("@/components/ui/popover", async () => {
  const { createContext, useContext, cloneElement } = await import("react");
  const OpenContext = createContext({
    open: false,
    onOpenChange: (_open: boolean) => {},
  });
  return {
    Popover: ({
      children,
      open,
      onOpenChange,
    }: {
      children: React.ReactNode;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <OpenContext.Provider value={{ open, onOpenChange }}>
        {children}
      </OpenContext.Provider>
    ),
    PopoverTrigger: ({ render }: { render: React.ReactElement }) => {
      const { onOpenChange } = useContext(OpenContext);
      return cloneElement(render as React.ReactElement<{ onClick: () => void }>, {
        onClick: () => onOpenChange(true),
      });
    },
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      useContext(OpenContext).open ? <div>{children}</div> : null,
  };
});
vi.mock("@/lib/orpc/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/orpc/orpc")>();

  return {
    ...original,
    orpc: {
      projects: { searchHosted: mocks.searchHosted },
      organizations: { search: mocks.searchOrganizations },
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
      <ProjectPartnershipManager canAssign />
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
    queryKey: orpcQuery.projects.listHosted.key({ type: "query" }),
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projects.listPartner.key({ type: "query" }),
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: orpcQuery.projects.get.key({ type: "query" }),
  });
}

async function selectAssignment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Hosted Project" }));
  await user.type(
    await screen.findByLabelText("Search Hosted Project by name or ID"),
    "New",
  );
  await user.click(await screen.findByText("New Project"));
  await user.click(screen.getByRole("button", { name: "Partner Organization" }));
  await user.type(
    await screen.findByLabelText("Search Partner Organization by name or ID"),
    "New",
  );
  await user.click(await screen.findByText("New Partner"));
}

describe("ProjectPartnershipManager", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", mocks.confirm);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    mocks.assign.mockReset().mockResolvedValue(assignedPartnership);
    mocks.confirm.mockClear();
    mocks.list.mockReset();
    mocks.searchHosted
      .mockReset()
      .mockResolvedValue([{ id: "project-new", name: "New Project" }]);
    mocks.searchOrganizations
      .mockReset()
      .mockResolvedValue([{ id: "organization-new", name: "New Partner" }]);
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

    await selectAssignment(user);
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

  it("shows a safe message instead of a remote mutation error", async () => {
    mocks.assign.mockRejectedValue(
      new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "postgres://internal-user:secret@database/private",
      }),
    );
    mocks.list.mockResolvedValue([existingPartnership]);
    const user = userEvent.setup();
    await renderManager([existingPartnership]);

    await selectAssignment(user);
    await user.click(screen.getByRole("button", { name: "Assign" }));

    expect(
      await screen.findByText("The request failed with HTTP 500. Try again."),
    ).toBeTruthy();
    expect(
      screen.queryByText(/internal-user|secret|database\/private/),
    ).toBeNull();
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
    expect(mocks.remove).toHaveBeenCalledWith({ id: existingPartnership.id });
    expectProjectDataInvalidation(invalidateQueries);
  });
});
