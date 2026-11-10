import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
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
      },
    },
  };
});

import { AssignOrganizationDialog } from "@/features/partnerships/components/project-partnership-assigner";
import { orpcQuery } from "@/lib/orpc/orpc";

async function renderDialog() {
  const queryClient = createQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <AssignOrganizationDialog />
    </QueryClientProvider>,
  );
  await userEvent.setup().click(screen.getByTestId("assign-organization"));
  return { invalidateQueries };
}

async function selectAssignment(user: ReturnType<typeof userEvent.setup>) {
  const dialog = within(screen.getByTestId("organization-assignment"));
  await user.click(
    within(dialog.getByTestId("hosted-project-picker")).getByTestId(
      "entity-combobox-trigger",
    ),
  );
  await user.type(await screen.findByTestId("entity-search"), "New");
  await user.click(await screen.findByRole("option"));
  await user.click(
    within(dialog.getByTestId("partner-organization-picker")).getByTestId(
      "entity-combobox-trigger",
    ),
  );
  await user.type(await screen.findByTestId("entity-search"), "New");
  await user.click(await screen.findByRole("option"));
}

function expectProjectDataInvalidation(
  invalidateQueries: ReturnType<typeof vi.fn>,
) {
  // Red if any generated Project query family is removed from invalidation.
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

describe("AssignOrganizationDialog", () => {
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
    mocks.assign.mockReset().mockResolvedValue({ id: "partnership-new" });
    mocks.searchHosted
      .mockReset()
      .mockResolvedValue([{ id: "project-new", name: "New Project" }]);
    mocks.searchOrganizations
      .mockReset()
      .mockResolvedValue([{ id: "organization-new", name: "New Partner" }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("assigns through the dialog, closes, and invalidates Project queries", async () => {
    const user = userEvent.setup();
    const { invalidateQueries } = await renderDialog();

    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));

    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith({
        organizationId: "organization-new",
        projectId: "project-new",
      });
    });
    expectProjectDataInvalidation(invalidateQueries);
    await waitFor(() => {
      expect(
        screen.queryByTestId("organization-assignment"),
      ).not.toBeInTheDocument();
    });
  });

  it("reports a failed assignment inside the dialog and keeps it open", async () => {
    const user = userEvent.setup();
    mocks.assign.mockRejectedValue(
      new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "postgres://internal-user:secret@database/private",
      }),
    );
    await renderDialog();

    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));

    const dialog = within(screen.getByTestId("organization-assignment"));
    expect(await dialog.findByRole("alert")).toBeVisible();
  });
});
