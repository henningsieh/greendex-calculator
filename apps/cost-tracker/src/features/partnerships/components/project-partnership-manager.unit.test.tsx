import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
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

import { ProjectPartnershipManager } from "@/features/partnerships/components/project-partnership-manager";
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

  await screen.findByTestId(`partnership-row-${partnerships[0]?.organizationId}`);
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
  await user.click(
    within(screen.getByTestId("hosted-project-picker")).getByTestId(
      "entity-combobox-trigger",
    ),
  );
  await user.type(await screen.findByTestId("entity-search"), "New");
  await user.click(await screen.findByRole("option"));
  await user.click(
    within(screen.getByTestId("partner-organization-picker")).getByTestId(
      "entity-combobox-trigger",
    ),
  );
  await user.type(await screen.findByTestId("entity-search"), "New");
  await user.click(await screen.findByRole("option"));
}

describe("ProjectPartnershipManager", () => {
  beforeEach(() => {
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

  it("preloads one option per entity while retaining every partnership row", async () => {
    const partnerships = [
      existingPartnership,
      {
        ...existingPartnership,
        id: "partnership-shared-project",
        organizationId: assignedPartnership.organizationId,
        organizationName: assignedPartnership.organizationName,
      },
      assignedPartnership,
    ];
    mocks.list.mockResolvedValue(partnerships);
    const user = userEvent.setup();
    await renderManager(partnerships);

    expect(screen.getAllByTestId(/^partnership-row-/)).toHaveLength(3);

    const projectPicker = within(screen.getByTestId("hosted-project-picker"));
    await user.click(projectPicker.getByTestId("entity-combobox-trigger"));
    expect(
      projectPicker
        .getAllByTestId(/^entity-option-/)
        .map((option) => option.getAttribute("data-entity-id")),
    ).toEqual(["project-existing", "project-new"]);

    const organizationPicker = within(
      screen.getByTestId("partner-organization-picker"),
    );
    await user.click(organizationPicker.getByTestId("entity-combobox-trigger"));
    expect(
      organizationPicker
        .getAllByTestId(/^entity-option-/)
        .map((option) => option.getAttribute("data-entity-id")),
    ).toEqual(["organization-existing", "organization-new"]);
  });

  it("invalidates generated Project query families and refreshes the visible list after assignment", async () => {
    mocks.list
      .mockResolvedValueOnce([existingPartnership])
      .mockResolvedValueOnce([assignedPartnership]);
    const user = userEvent.setup();
    const { invalidateQueries } = await renderManager([existingPartnership]);

    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));

    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith({
        organizationId: assignedPartnership.organizationId,
        projectId: assignedPartnership.projectId,
      });
    });
    await screen.findByTestId("partnership-row-organization-new");
    // Red if the list query is not invalidated and refetched after a successful assign.
    expect(
      screen.queryByTestId("partnership-row-organization-existing"),
    ).toBeNull();
    expectProjectDataInvalidation(invalidateQueries);
  });

  it("reports a failed assignment through the error feedback state", async () => {
    mocks.assign.mockRejectedValue(
      new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "postgres://internal-user:secret@database/private",
      }),
    );
    mocks.list.mockResolvedValue([existingPartnership]);
    const user = userEvent.setup();
    await renderManager([existingPartnership]);

    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));

    expect(await screen.findByTestId("partnership-feedback")).toBeTruthy();
    expect(screen.getByTestId("partnership-feedback")).toHaveAttribute(
      "data-state",
      "error",
    );
  });

  it("reports success after a failed removal followed by a successful assignment", async () => {
    mocks.remove.mockRejectedValueOnce(
      new ORPCError("INTERNAL_SERVER_ERROR", { message: "db down" }),
    );
    mocks.list.mockResolvedValue([existingPartnership]);
    const user = userEvent.setup();
    await renderManager([existingPartnership]);

    await user.click(
      screen.getByTestId("remove-partnership-partnership-existing"),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );
    expect(await screen.findByTestId("partnership-feedback")).toHaveAttribute(
      "data-state",
      "error",
    );

    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));
    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalled();
    });
    expect(screen.getByTestId("partnership-feedback")).toHaveAttribute(
      "data-state",
      "success",
    );
  });

  it("invalidates generated Project query families and refreshes the visible list after removal", async () => {
    mocks.list
      .mockResolvedValueOnce([existingPartnership])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    const { invalidateQueries } = await renderManager([existingPartnership]);

    await user.click(
      screen.getByTestId("remove-partnership-partnership-existing"),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );

    await waitFor(() => {
      // Red if remove succeeds without invalidating the active list query.
      expect(screen.getByTestId("partnerships-empty")).toBeTruthy();
    });
    expect(mocks.remove).toHaveBeenCalledWith({ id: existingPartnership.id });
    expectProjectDataInvalidation(invalidateQueries);
  });
  it("keeps a cancelled removal intact and disables removal while executing", async () => {
    mocks.list.mockResolvedValue([existingPartnership]);
    mocks.remove.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    await renderManager([existingPartnership]);
    const trigger = screen.getByTestId("remove-partnership-partnership-existing");
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith({
      id: "partnership-existing",
    });
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
