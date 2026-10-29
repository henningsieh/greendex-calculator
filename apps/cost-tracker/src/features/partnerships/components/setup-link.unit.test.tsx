import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consume: vi.fn(),
  eligibility: vi.fn(),
  setActive: vi.fn(),
  refresh: vi.fn(),
  createOrganization: vi.fn(),
  writeText: vi.fn(),
  searchHosted: vi.fn(),
  listMine: vi.fn(),
  listSetupLinks: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
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
      authentication: { createOrganization: mocks.createOrganization },
      projectPartnerships: {
        createSetupLink: mocks.create,
        consumeSetupLink: mocks.consume,
        getSetupLinkEligibility: mocks.eligibility,
      },
      projects: { searchHosted: mocks.searchHosted },
      organizations: { listMine: mocks.listMine },
    },
    orpcQuery: {
      projectPartnerships: {
        listSetupLinks: {
          ...original.orpcQuery.projectPartnerships.listSetupLinks,
          queryOptions: (
            ...args: Parameters<
              typeof original.orpcQuery.projectPartnerships.listSetupLinks.queryOptions
            >
          ) => ({
            ...original.orpcQuery.projectPartnerships.listSetupLinks.queryOptions(
              ...args,
            ),
            queryFn: mocks.listSetupLinks,
          }),
        },
      },
    },
  };
});

import { SetupLinkCreator } from "@/features/partnerships/components/setup-link";

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.eligibility.mockResolvedValue({
    status: "eligible",
    projectId: "project-1",
  });
  mocks.setActive.mockResolvedValue({ data: {} });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText: mocks.writeText } });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.listSetupLinks.mockResolvedValue([]);
  mocks.createOrganization.mockResolvedValue({
    success: true,
    organizationId: "partner-2",
  });
  mocks.create.mockResolvedValue({
    id: "link-1",
    secret: "private-secret",
    expiresAt: new Date("2026-12-01"),
  });
  mocks.searchHosted.mockResolvedValue([
    { id: "project-1", name: "Hosted Example" },
  ]);
  mocks.listMine.mockResolvedValue([
    { id: "partner-1", name: "My Organization" },
  ]);
  mocks.consume.mockResolvedValue({
    partnershipId: "partnership-1",
    organizationId: "partner-1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function creator() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <SetupLinkCreator />
    </QueryClientProvider>,
  );
}

describe("Setup Link UI", () => {
  it("renders the server-provided expiry status without reading the clock during render", async () => {
    mocks.listSetupLinks.mockResolvedValue([
      {
        id: "expired-link",
        projectName: "Hosted Example",
        recipientEmail: "partner@example.org",
        enabled: true,
        consumedAt: null,
        expired: true,
        expiresAt: new Date("2099-01-01"),
      },
    ]);
    creator();
    await screen.findByRole("table");
    expect(
      document.querySelector(
        '[data-setup-link-id="expired-link"] [data-link-status]',
      ),
    ).toHaveAttribute("data-link-status", "expired");
  });

  it("creates a recipient-bound link, displays it and copies the URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      mocks.writeText,
    );
    creator();
    await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    await user.type(screen.getByTestId("entity-search"), "Host");
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(screen.getByTestId("setup-email"), "partner@example.com");
    await user.click(screen.getByTestId("create-setup-link"));
    await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenCalledWith({
      projectId: "project-1",
      recipientEmail: "partner@example.com",
    });
    const url = screen.getByTestId("recipient-link") as HTMLInputElement;
    expect(url.value).toContain("/setup-links/link-1?secret=private-secret");
    await user.click(screen.getByTestId("copy-setup-link"));
    expect(mocks.writeText).toHaveBeenCalledWith(url.value);
  });

  it("prevents repeat issuance while the new link is pending", async () => {
    const user = userEvent.setup();
    mocks.create.mockReturnValue(new Promise(() => {}));
    creator();
    await user.click(screen.getByTestId("entity-combobox-trigger"));
    await user.type(screen.getByTestId("entity-search"), "Host");
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(screen.getByTestId("setup-email"), "partner@example.com");
    const submit = screen.getByTestId("create-setup-link");
    await user.click(submit);
    expect(submit).toBeDisabled();
  });
});
