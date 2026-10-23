import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  SetupLinkCreator,
  SetupLinkRecipient,
} from "@/features/projects/components/setup-link";

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

function recipient(secret = "private-secret") {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SetupLinkRecipient id="link-1" secret={secret} userId="user-1" />
    </QueryClientProvider>,
  );
}
async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  name: string,
  id: string,
) {
  await user.click(screen.getByRole("button", { name: label }));
  await user.type(screen.getByLabelText(`Search ${label} by name or ID`), name);
  const option = await screen.findByRole("option");
  expect(option).toHaveAttribute("data-value", id);
  await user.click(option);
}

async function expectSetupError(state: string) {
  await waitFor(() =>
    expect(document.querySelector(`[data-setup-error="${state}"]`)).toBeVisible(),
  );
}

async function submitExisting() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("radio", { name: "Existing Organization" }),
  );
  await selectOption(user, "Organization", "My Organization", "partner-1");
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
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
    await user.click(screen.getByRole("button", { name: "Hosted Project" }));
    await user.type(
      screen.getByLabelText("Search Hosted Project by name or ID"),
      "Host",
    );
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(
      screen.getByLabelText("Recipient email"),
      "partner@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Neuer Link" }));
    await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenCalledWith({
      projectId: "project-1",
      recipientEmail: "partner@example.com",
    });
    const url = screen.getByLabelText("Recipient setup link") as HTMLInputElement;
    expect(url.value).toContain("/setup-links/link-1?secret=private-secret");
    await user.click(screen.getByRole("button", { name: "Kopieren" }));
    expect(mocks.writeText).toHaveBeenCalledWith(url.value);
  });

  it("prevents repeat issuance while the new link is pending", async () => {
    const user = userEvent.setup();
    mocks.create.mockReturnValue(new Promise(() => {}));
    creator();
    await user.click(screen.getByRole("button", { name: "Hosted Project" }));
    await user.type(
      screen.getByLabelText("Search Hosted Project by name or ID"),
      "Host",
    );
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(
      screen.getByLabelText("Recipient email"),
      "partner@example.com",
    );
    const submit = screen.getByRole("button", { name: "Neuer Link" });
    await user.click(submit);
    expect(submit).toBeDisabled();
  });

  it("does not submit a missing secret", () => {
    recipient("");
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-setup-error",
      "invalid",
    );
    expect(mocks.eligibility).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Complete setup" })).toBeNull();
  });

  it("creates the Organization through the supported flow, then binds it", async () => {
    mocks.listMine.mockResolvedValue([{ id: "partner-2", name: "New Partner" }]);
    recipient();
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText("Organization country"),
      "DE",
    );
    await user.type(
      screen.getByLabelText("New Organization name"),
      "New Partner",
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.createOrganization).toHaveBeenCalledWith({
      country: "DE" as const,
      name: "New Partner",
      slug: "new-partner",
    });
    expect(mocks.listMine).not.toHaveBeenCalled();
    expect(mocks.eligibility).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(localStorage.getItem("partner-setup:user-1:link-1")!),
    ).toEqual({ phase: "created", organizationId: "partner-2" });
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organizationId: "partner-2",
    });
    expect(
      await screen.findByRole("button", { name: "Use this Organization" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-relationship",
      "project-partnership",
    );
  });

  it.each(["A", "A!", "A !!!", "!!!", "éé"])(
    "rejects normalized invalid name %s before saving intent and accepts correction",
    async (name) => {
      mocks.createOrganization.mockImplementation(async (input) => {
        if (input.name !== "New Partner") throw new ORPCError("BAD_REQUEST");
        return { organizationId: "partner-2" };
      });
      recipient();
      const user = userEvent.setup({ delay: null });
      await user.type(
        await screen.findByLabelText("New Organization name"),
        name,
      );
      await user.selectOptions(
        screen.getByLabelText("Organization country"),
        "DE",
      );
      fireEvent.submit(
        screen.getByRole("button", { name: "Complete setup" }).closest("form")!,
      );
      await waitFor(() => expect(mocks.eligibility).toHaveBeenCalledTimes(2));
      expect(localStorage.getItem("partner-setup:user-1:link-1")).toBeNull();
      expect(mocks.createOrganization).not.toHaveBeenCalled();
      await user.clear(screen.getByLabelText("New Organization name"));
      await user.type(
        screen.getByLabelText("New Organization name"),
        "  New Partner  ",
      );
      await user.click(screen.getByRole("button", { name: "Complete setup" }));
      expect(
        await screen.findByRole("button", { name: "Use this Organization" }),
      ).toBeVisible();
      expect(mocks.createOrganization).toHaveBeenCalledExactlyOnceWith({
        country: "DE",
        name: "New Partner",
        slug: "new-partner",
      });
    },
  );

  it("refuses clearly when Organization creation fails", async () => {
    mocks.createOrganization.mockRejectedValue(new Error("BA refused"));
    recipient();
    const user = userEvent.setup();
    await user.selectOptions(
      await screen.findByLabelText("Organization country"),
      "DE",
    );
    await user.type(
      screen.getByLabelText("New Organization name"),
      "New Partner",
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await expectSetupError("create");
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("allows a corrected name after confirmed duplicate rejection and completes on revisit", async () => {
    mocks.createOrganization.mockRejectedValueOnce(
      new ORPCError("BAD_REQUEST", {
        data: { reason: "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION" },
      }),
    );
    const view = recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "Taken Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await expectSetupError("create");
    expect(localStorage.getItem("partner-setup:user-1:link-1")).toBeNull();
    await user.clear(await screen.findByLabelText("New Organization name"));
    await user.type(
      screen.getByLabelText("New Organization name"),
      "Available Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(
      await screen.findByRole("button", { name: "Use this Organization" }),
    ).toBeVisible();
    expect(
      mocks.createOrganization.mock.calls.map(([input]) => input.slug),
    ).toEqual(["taken-partner", "available-partner"]);
    expect(mocks.consume).toHaveBeenCalledExactlyOnceWith({
      id: "link-1",
      secret: "private-secret",
      organizationId: "partner-2",
    });
    view.unmount();
    mocks.eligibility.mockResolvedValue({
      status: "redeemed",
      projectId: "project-1",
      organizationId: "partner-2",
      partnershipId: "partnership-1",
    });
    recipient();
    expect(
      await screen.findByRole("button", { name: "Use this Organization" }),
    ).toBeVisible();
    expect(mocks.createOrganization).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
  });

  it("requires an existing selection and sends its ID for server verification", async () => {
    recipient();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("radio", { name: "Existing Organization" }),
    );
    expect(screen.getByRole("button", { name: "Complete setup" })).toBeDisabled();
    await selectOption(user, "Organization", "My Organization", "partner-1");
    expect(mocks.listMine).toHaveBeenCalledWith({ search: "My Organization" });
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organizationId: "partner-1",
    });
  });

  it("retains the exact returned ID across failure, inspection, remount and retry", async () => {
    mocks.consume.mockRejectedValueOnce(new Error("response lost"));
    const view = recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "New Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByRole("button", { name: "Inspect setup result" });
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Inspect setup result" }),
    );
    await screen.findByRole("button", {
      name: "Retry setup with retained Organization",
    });
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    view.unmount();
    recipient();
    await user.click(
      await screen.findByRole("button", {
        name: "Retry setup with retained Organization",
      }),
    );
    await screen.findByRole("button", { name: "Use this Organization" });
    expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
    expect(
      mocks.consume.mock.calls.map(([input]) => input.organizationId),
    ).toEqual(["partner-2", "partner-2"]);
  });

  it("inspects a successful uncertain redemption without repeating either mutation", async () => {
    mocks.consume.mockRejectedValueOnce(new Error("response lost"));
    recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "New Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByRole("button", { name: "Inspect setup result" });
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    mocks.eligibility.mockResolvedValue({
      status: "redeemed",
      projectId: "project-1",
      organizationId: "partner-2",
      partnershipId: "partnership-1",
    });
    await user.click(
      screen.getByRole("button", { name: "Inspect setup result" }),
    );
    await screen.findByRole("button", { name: "Use this Organization" });
    expect(mocks.consume).toHaveBeenCalledTimes(1);
    expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
    expect(mocks.setActive).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Use this Organization" }),
    );
    expect(
      await screen.findByRole("link", { name: "Open Partner Project" }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: "partner-2",
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when explicit Organization selection is refused", async () => {
    mocks.eligibility.mockResolvedValue({
      status: "redeemed",
      projectId: "project-1",
      organizationId: "partner-2",
      partnershipId: "partnership-1",
    });
    mocks.setActive.mockResolvedValue({ error: { message: "revoked" } });
    recipient();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Use this Organization" }),
    );
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: "partner-2",
    });
    expect(
      screen.queryByRole("link", { name: "Open Partner Project" }),
    ).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("holds the Partner Project link while selection and invalidation stay pending", async () => {
    mocks.eligibility.mockResolvedValue({
      status: "redeemed",
      projectId: "project-1",
      organizationId: "partner-2",
      partnershipId: "partnership-1",
    });
    let resolveActive!: (value: { data: object }) => void;
    let resolveInvalidated!: () => void;
    mocks.setActive.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveActive = resolve;
      }),
    );
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    invalidate.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveInvalidated = resolve;
      }),
    );
    recipient();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Use this Organization" }),
    );
    expect(screen.getByRole("button")).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Open Partner Project" }),
    ).toBeNull();
    resolveActive({ data: {} });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button")).toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Open Partner Project" }),
    ).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
    resolveInvalidated();
    expect(
      await screen.findByRole("link", { name: "Open Partner Project" }),
    ).toHaveAttribute("href", "/projects/project-1");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Error("lost response"),
    new ORPCError("INTERNAL_SERVER_ERROR", {
      data: { reason: "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION" },
    }),
    new ORPCError("BAD_REQUEST", {
      message: "This Organization name is already in use. Choose another name.",
    }),
  ])(
    "blocks repeat creation after an uncertain creation response, including a revisit (%s)",
    async (error) => {
      mocks.createOrganization.mockRejectedValue(error);
      const view = recipient();
      const user = userEvent.setup();
      await user.type(
        await screen.findByLabelText("New Organization name"),
        "New Partner",
      );
      await user.selectOptions(
        screen.getByLabelText("Organization country"),
        "DE",
      );
      await user.click(screen.getByRole("button", { name: "Complete setup" }));
      await expectSetupError("create");
      view.unmount();
      recipient();
      await screen.findByRole("alert");
      expect(screen.queryByLabelText("New Organization name")).toBeNull();
      await selectOption(user, "Organization", "My Organization", "partner-1");
      await user.click(screen.getByRole("button", { name: "Complete setup" }));
      await screen.findByRole("button", { name: "Use this Organization" });
      expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
      expect(mocks.consume).toHaveBeenCalledExactlyOnceWith({
        id: "link-1",
        secret: "private-secret",
        organizationId: "partner-1",
      });
    },
  );

  it("revalidates eligibility before creating even when the initial check passed", async () => {
    recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "New Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    mocks.eligibility.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { data: { reason: "SETUP_LINK_DISABLED" } }),
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await expectSetupError("disabled");
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("allows an existing selection refused by Owner verification to be explicitly corrected", async () => {
    mocks.consume.mockRejectedValueOnce(
      new ORPCError("FORBIDDEN", {
        data: { reason: "ORGANIZATION_OWNER_REQUIRED" },
      }),
    );
    recipient();
    await submitExisting();
    await expectSetupError("owner");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Inspect setup result" }),
    );
    expect(
      await screen.findByRole("button", { name: "Complete setup" }),
    ).toBeEnabled();
    mocks.listMine.mockResolvedValue([
      { id: "partner-3", name: "Another Owned Organization" },
    ]);
    mocks.consume.mockResolvedValue({
      partnershipId: "partnership-3",
      organizationId: "partner-3",
    });
    await selectOption(
      user,
      "Organization",
      "Another Owned Organization",
      "partner-3",
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByRole("button", { name: "Use this Organization" });
    expect(
      mocks.consume.mock.calls.map(([input]) => input.organizationId),
    ).toEqual(["partner-1", "partner-3"]);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("partner-setup:user-1:link-1")!),
    ).toEqual({ phase: "selected", organizationId: "partner-3" });
  });

  it("recovers an exact existing selection after an uncertain binding response and a revisit", async () => {
    mocks.consume.mockRejectedValueOnce(new Error("lost response"));
    const view = recipient();
    await submitExisting();
    await screen.findByRole("button", { name: "Inspect setup result" });
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    view.unmount();
    recipient();
    expect(
      await screen.findByRole("button", { name: "Complete setup" }),
    ).toBeEnabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByRole("button", { name: "Use this Organization" });
    expect(
      mocks.consume.mock.calls.map(([input]) => input.organizationId),
    ).toEqual(["partner-1", "partner-1"]);
    expect(mocks.createOrganization).not.toHaveBeenCalled();
  });

  it("does not create when durable recovery storage is unavailable", async () => {
    recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "New Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await expectSetupError("create");
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("does not adopt another User's retained Organization", async () => {
    localStorage.setItem(
      "partner-setup:other-user:link-1",
      JSON.stringify({ phase: "created", organizationId: "foreign-org" }),
    );
    recipient();
    expect(await screen.findByLabelText("New Organization name")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("requires existing-Organization inspection for a corrupt recovery checkpoint", async () => {
    localStorage.setItem("partner-setup:user-1:link-1", "corrupt");
    recipient();
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
    expect(
      await screen.findByRole("button", { name: /^Organization$/ }),
    ).toBeVisible();
  });

  const states = [
    {
      code: "FORBIDDEN",
      reason: "EMAIL_VERIFICATION_REQUIRED",
      state: "verify-email",
    },
    {
      code: "NOT_FOUND",
      reason: "SETUP_LINK_NOT_FOUND",
      state: "invalid",
    },
    {
      code: "BAD_REQUEST",
      reason: "SETUP_LINK_DISABLED",
      state: "disabled",
    },
    {
      code: "BAD_REQUEST",
      reason: "SETUP_LINK_EXPIRED",
      state: "expired",
    },
    {
      code: "FORBIDDEN",
      reason: "SETUP_LINK_WRONG_EMAIL",
      state: "wrong-email",
    },
    {
      code: "BAD_REQUEST",
      reason: "SETUP_LINK_USED",
      state: "duplicate",
    },
    {
      code: "FORBIDDEN",
      reason: "ORGANIZATION_OWNER_REQUIRED",
      state: "owner",
    },
    {
      code: "BAD_REQUEST",
      reason: "PARTNERSHIP_ALREADY_ASSIGNED",
      state: "duplicate",
    },
    {
      code: "NOT_FOUND",
      reason: "PROJECT_NOT_FOUND",
      state: "unavailable",
    },
    {
      code: "BAD_REQUEST",
      reason: "SELF_PARTNERSHIP",
      state: "host",
    },
  ];

  it.each(
    states.filter(({ reason }) =>
      [
        "EMAIL_VERIFICATION_REQUIRED",
        "SETUP_LINK_NOT_FOUND",
        "SETUP_LINK_DISABLED",
        "SETUP_LINK_EXPIRED",
        "SETUP_LINK_WRONG_EMAIL",
        "PROJECT_NOT_FOUND",
      ].includes(reason),
    ),
  )("refuses $reason before either mutation", async ({ code, reason, state }) => {
    mocks.eligibility.mockRejectedValue(
      new ORPCError(code, { data: { reason } }),
    );
    recipient();
    await expectSetupError(state);
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it.each(states)(
    "maps $code / $reason to $state without reading the remote message",
    async ({ code, reason, state }) => {
      const message = vi.fn(() => "Untrusted remote copy");
      const error = new ORPCError(code, { data: { reason } });
      Object.defineProperty(error, "message", { get: message });
      mocks.consume.mockRejectedValue(error);
      recipient();
      await submitExisting();
      await expectSetupError(state);
      expect(message).not.toHaveBeenCalled();
    },
  );

  it("does not mistake a known message paired with the wrong code for a link state", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("FORBIDDEN", {
        message: "This setup link is disabled.",
        data: { reason: "SETUP_LINK_DISABLED" },
      }),
    );
    recipient();
    await submitExisting();
    expect(
      await screen.findByRole("button", { name: "Inspect setup result" }),
    ).toBeVisible();
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete setup" })).toBeNull();
  });

  it("does not activate a link state for contradictory code/reason metadata", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("FORBIDDEN", {
        message: "This setup link is disabled.",
        data: { reason: "SETUP_LINK_DISABLED" },
      }),
    );
    recipient();
    await submitExisting();
    expect(
      await screen.findByRole("button", { name: "Inspect setup result" }),
    ).toBeVisible();
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Complete setup" })).toBeNull();
  });

  it("renders an unknown error without reading its remote message", async () => {
    const message = vi.fn(() => "postgres://private");
    const error = new ORPCError("BAD_REQUEST");
    Object.defineProperty(error, "message", { get: message });
    mocks.consume.mockRejectedValue(error);
    recipient();
    await submitExisting();
    expect(
      await screen.findByRole("button", { name: "Inspect setup result" }),
    ).toBeVisible();
    expect(document.querySelector("[data-setup-error]")).toBeNull();
    expect(message).not.toHaveBeenCalled();
  });
});
