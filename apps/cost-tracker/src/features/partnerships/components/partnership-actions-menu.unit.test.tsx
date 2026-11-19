import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({ projects: vi.fn(), organizations: vi.fn() }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpcQuery: {
    projects: {
      listHostedOptions: {
        queryOptions: () => ({ queryKey: ["projects"], queryFn: mocks.projects }),
      },
    },
    organizations: {
      listOptions: {
        queryOptions: () => ({
          queryKey: ["organizations"],
          queryFn: mocks.organizations,
        }),
      },
    },
  },
}));
vi.mock("@/features/partnerships/components/setup-link", () => ({
  CreateSetupLinkDialog: ({ open }: { open?: boolean }) => (
    <div
      data-testid="setup-dialog"
      data-open={open === true ? "true" : undefined}
    />
  ),
}));
vi.mock(
  "@/features/partnerships/components/project-partnership-assigner",
  () => ({
    AssignOrganizationDialog: ({ open }: { open?: boolean }) => (
      <div
        data-testid="assign-dialog"
        data-open={open === true ? "true" : undefined}
      />
    ),
  }),
);

import {
  PartnershipActions,
  PartnershipShortcutLinks,
} from "./partnership-actions";

function view(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["projects"], [{ id: "p", name: "Project A" }]);
  client.setQueryData(["organizations"], [{ id: "o", name: "Organization A" }]);
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={<p>Loading</p>}>{ui}</Suspense>
    </QueryClientProvider>
  );
}

describe("PartnershipActions menu", () => {
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
    mocks.projects.mockResolvedValue([{ id: "p", name: "Project A" }]);
    mocks.organizations.mockResolvedValue([{ id: "o", name: "Organization A" }]);
  });

  it("opens the Invite dialog from the menu", async () => {
    const user = userEvent.setup();
    render(view(<PartnershipActions />));
    await user.click(await screen.findByTestId("partnership-actions-menu"));
    await user.click(await screen.findByTestId("new-setup-link"));
    expect(screen.getByTestId("setup-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("assign-dialog")).not.toHaveAttribute("data-open");
  });

  it("opens the Assign dialog from the menu", async () => {
    const user = userEvent.setup();
    render(view(<PartnershipActions />));
    await user.click(await screen.findByTestId("partnership-actions-menu"));
    await user.click(await screen.findByTestId("assign-organization"));
    expect(screen.getByTestId("assign-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("setup-dialog")).not.toHaveAttribute("data-open");
  });

  it("opens both dialogs from the inline empty-state shortcuts", async () => {
    const user = userEvent.setup();
    render(view(<PartnershipShortcutLinks projectId="p" />));
    await user.click(await screen.findByTestId("invite-partnership-link"));
    expect(screen.getByTestId("setup-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
    await user.click(await screen.findByTestId("assign-partnership-link"));
    expect(screen.getByTestId("assign-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
  });
});
