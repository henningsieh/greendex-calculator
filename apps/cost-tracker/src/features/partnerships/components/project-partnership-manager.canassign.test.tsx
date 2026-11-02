import { QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  listQuery: vi.fn(),
  searchHosted: vi.fn(),
  searchHostedQuery: vi.fn(),
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

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    projects: { searchHosted: mocks.searchHosted },
    organizations: { search: mocks.searchOrganizations },
    projectPartnerships: { assign: vi.fn(), remove: vi.fn() },
  },
  orpcQuery: {
    projects: {
      searchHosted: {
        queryOptions: (options?: { input?: unknown }) => ({
          queryKey: ["projects", "search-hosted", options?.input],
          queryFn: mocks.searchHostedQuery,
        }),
      },
      listHosted: { key: () => ["projects", "hosted"] },
      listPartner: { key: () => ["projects", "partner"] },
      get: { key: () => ["projects", "detail"] },
    },
    projectPartnerships: {
      list: {
        queryKey: () => ["partnerships", "list"],
        queryOptions: () => ({
          queryKey: ["partnerships", "list"],
          queryFn: mocks.listQuery,
        }),
      },
    },
  },
}));

import { ProjectPartnershipManager } from "@/features/partnerships/components/project-partnership-manager";

const existingPartnership = {
  id: "partnership-existing",
  projectId: "project-existing",
  projectName: "Existing Project",
  organizationId: "organization-existing",
  organizationName: "Existing Partner Organization",
  assignedAt: new Date("2026-02-01T12:00:00.000Z"),
  updatedAt: new Date("2026-02-01T12:00:00.000Z"),
};

async function renderManager(canAssign: boolean) {
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ProjectPartnershipManager canAssign={canAssign} />
    </QueryClientProvider>,
  );
  await screen.findByTestId(
    `partnership-row-${existingPartnership.organizationId}`,
  );
}

describe("ProjectPartnershipManager canAssign gate", () => {
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
    mocks.listQuery.mockReset().mockResolvedValue([existingPartnership]);
    mocks.searchHostedQuery
      .mockReset()
      .mockResolvedValue([{ id: "project-new", name: "New Project" }]);
  });

  it("does not execute the hosted-projects query when canAssign is false", async () => {
    await renderManager(false);

    expect(mocks.listQuery).toHaveBeenCalled();
    expect(mocks.searchHostedQuery).not.toHaveBeenCalled();
    expect(screen.queryByTestId("organization-assignment")).toBeNull();
  });

  it("executes the hosted-projects query when canAssign is true", async () => {
    await renderManager(true);

    expect(mocks.listQuery).toHaveBeenCalled();
    expect(mocks.searchHostedQuery).toHaveBeenCalled();
    expect(screen.getByTestId("organization-assignment")).toBeTruthy();
  });
});
