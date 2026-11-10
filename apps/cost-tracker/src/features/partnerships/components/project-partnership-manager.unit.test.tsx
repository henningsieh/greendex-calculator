import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
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
      projectPartnerships: {
        remove: mocks.remove,
      },
    },
    orpcQuery: {
      // NB: orpcQuery is a lazy proxy — never spread it. Reference the
      // routes the tree uses and override only the list queryFn.
      projects: {
        listHosted: original.orpcQuery.projects.listHosted,
        listPartner: original.orpcQuery.projects.listPartner,
        get: original.orpcQuery.projects.get,
      },
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
    mocks.list.mockReset();
    mocks.remove
      .mockReset()
      .mockResolvedValue({ id: existingPartnership.id, removed: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports success after a failed removal followed by a successful removal", async () => {
    mocks.remove.mockRejectedValueOnce(
      new ORPCError("INTERNAL_SERVER_ERROR", { message: "db down" }),
    );
    mocks.list.mockResolvedValue([existingPartnership]);
    const user = userEvent.setup();
    await renderManager([existingPartnership]);

    const removeTrigger = screen.getByTestId(
      "remove-partnership-partnership-existing",
    );
    await user.click(removeTrigger);
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );
    expect(await screen.findByTestId("partnership-feedback")).toHaveAttribute(
      "data-state",
      "error",
    );

    await user.click(removeTrigger);
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );
    await waitFor(() => {
      expect(mocks.remove).toHaveBeenCalledTimes(2);
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
