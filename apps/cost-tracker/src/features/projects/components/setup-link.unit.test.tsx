import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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
) {
  await user.click(screen.getByRole("button", { name: label }));
  await user.type(screen.getByLabelText(`Search ${label} by name or ID`), name);
  await user.click(await screen.findByText(name));
}

async function submitExisting() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("radio", { name: "Existing Organization" }),
  );
  await selectOption(user, "Organization", "My Organization");
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
    expect(await screen.findByText("Expired")).toBeTruthy();
  });

  it("creates a recipient-bound link, displays it and copies the URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      mocks.writeText,
    );
    creator();
    await screen.findByText("No Partner Organization Setup Links yet.");
    await user.click(screen.getByRole("button", { name: "Hosted Project" }));
    await user.type(
      screen.getByLabelText("Search Hosted Project by name or ID"),
      "Host",
    );
    await user.click(await screen.findByText("Hosted Example"));
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

  it("uses the approved new-link wording while issuance is pending", async () => {
    const user = userEvent.setup();
    mocks.create.mockReturnValue(new Promise(() => {}));
    creator();
    await user.click(screen.getByRole("button", { name: "Hosted Project" }));
    await user.type(
      screen.getByLabelText("Search Hosted Project by name or ID"),
      "Host",
    );
    await user.click(await screen.findByText("Hosted Example"));
    await user.type(
      screen.getByLabelText("Recipient email"),
      "partner@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Neuer Link" }));
    expect(screen.getByRole("button", { name: "Neuer Link…" })).toBeDisabled();
  });

  it("does not submit a missing secret", () => {
    recipient("");
    expect(screen.getByText("Invalid setup link")).toBeTruthy();
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
    expect(await screen.findByText("Project Partnership created")).toBeTruthy();
    expect(
      screen.getByText(/does not grant Hosting Organization membership/i),
    ).toBeTruthy();
  });

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
    expect(await screen.findByText("Could not create Organization")).toBeTruthy();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("shows Owner verification on the existing path and sends the ID for server verification", async () => {
    recipient();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("radio", { name: "Existing Organization" }),
    );
    expect(screen.getByText(/verified by the server/i)).toBeTruthy();
    await selectOption(user, "Organization", "My Organization");
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
    await screen.findByText("Setup result needs inspection");
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
    await screen.findByText("Project Partnership created");
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
    await screen.findByText("Setup result needs inspection");
    mocks.eligibility.mockResolvedValue({
      status: "redeemed",
      projectId: "project-1",
      organizationId: "partner-2",
      partnershipId: "partnership-1",
    });
    await user.click(
      screen.getByRole("button", { name: "Inspect setup result" }),
    );
    await screen.findByText("Project Partnership created");
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
    await screen.findByText(/Could not confirm Organization selection/);
    expect(
      screen.queryByRole("link", { name: "Open Partner Project" }),
    ).toBeNull();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.createOrganization).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("blocks repeat creation after a lost creation response, including a revisit", async () => {
    mocks.createOrganization.mockRejectedValue(new Error("lost response"));
    const view = recipient();
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText("New Organization name"),
      "New Partner",
    );
    await user.selectOptions(screen.getByLabelText("Organization country"), "DE");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByText("Could not create Organization");
    view.unmount();
    recipient();
    await screen.findByText(/Organization creation may have completed/);
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
    await selectOption(user, "Organization", "My Organization");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByText("Project Partnership created");
    expect(mocks.createOrganization).toHaveBeenCalledTimes(1);
    expect(mocks.consume).toHaveBeenCalledExactlyOnceWith({
      id: "link-1",
      secret: "private-secret",
      organizationId: "partner-1",
    });
  });

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
    await screen.findByText("Disabled setup link");
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
    await screen.findByText("Owner verification required");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Inspect setup result" }),
    );
    await screen.findByText(
      /Continue with the existing Organization you selected/,
    );
    mocks.listMine.mockResolvedValue([
      { id: "partner-3", name: "Another Owned Organization" },
    ]);
    mocks.consume.mockResolvedValue({
      partnershipId: "partnership-3",
      organizationId: "partner-3",
    });
    await selectOption(user, "Organization", "Another Owned Organization");
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByText("Project Partnership created");
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
    await screen.findByText("Setup result needs inspection");
    view.unmount();
    recipient();
    await screen.findByText(
      /Continue with the existing Organization you selected/,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    await screen.findByText("Project Partnership created");
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
    await screen.findByText("Could not create Organization");
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
    expect(screen.queryByText("Organization retained")).toBeNull();
  });

  it("requires existing-Organization inspection for a corrupt recovery checkpoint", async () => {
    localStorage.setItem("partner-setup:user-1:link-1", "corrupt");
    recipient();
    await screen.findByText(/Organization creation may have completed/);
    expect(screen.queryByLabelText("New Organization name")).toBeNull();
    expect(
      await screen.findByRole("button", { name: /^Organization$/ }),
    ).toBeVisible();
  });

  const states = [
    {
      code: "FORBIDDEN",
      message: "Verify your email before continuing.",
      reason: "EMAIL_VERIFICATION_REQUIRED",
      heading: "Verify your email",
    },
    {
      code: "NOT_FOUND",
      message: "Setup link not found.",
      reason: "SETUP_LINK_NOT_FOUND",
      heading: "Invalid setup link",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link is disabled.",
      reason: "SETUP_LINK_DISABLED",
      heading: "Disabled setup link",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link has expired.",
      reason: "SETUP_LINK_EXPIRED",
      heading: "Expired setup link",
    },
    {
      code: "FORBIDDEN",
      message: "This setup link belongs to another email address.",
      reason: "SETUP_LINK_WRONG_EMAIL",
      heading: "Wrong email address",
    },
    {
      code: "BAD_REQUEST",
      message: "This setup link has already been used for another Organization.",
      reason: "SETUP_LINK_USED",
      heading: "Setup already completed",
    },
    {
      code: "FORBIDDEN",
      message: "You must be an Owner of the selected Organization.",
      reason: "ORGANIZATION_OWNER_REQUIRED",
      heading: "Owner verification required",
    },
    {
      code: "BAD_REQUEST",
      message: "This Organization is already assigned to the Project.",
      reason: "PARTNERSHIP_ALREADY_ASSIGNED",
      heading: "Setup already completed",
    },
    {
      code: "NOT_FOUND",
      message: "This Project is no longer available.",
      reason: "PROJECT_NOT_FOUND",
      heading: "Project unavailable",
    },
    {
      code: "BAD_REQUEST",
      message: "The Hosting Organization cannot be its own Partner Organization.",
      reason: "SELF_PARTNERSHIP",
      heading: "Invalid Partner Organization",
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
  )(
    "refuses $reason before either mutation",
    async ({ code, reason, heading }) => {
      mocks.eligibility.mockRejectedValue(
        new ORPCError(code, { data: { reason } }),
      );
      recipient();
      await screen.findByText(heading);
      expect(screen.queryByLabelText("New Organization name")).toBeNull();
      expect(mocks.createOrganization).not.toHaveBeenCalled();
      expect(mocks.consume).not.toHaveBeenCalled();
    },
  );

  it.each(states)(
    "maps $code / $message to $heading without displaying remote text",
    async ({ code, message, reason, heading }) => {
      mocks.consume.mockRejectedValue(
        new ORPCError(code, {
          message: "Untrusted remote copy",
          data: { reason },
        }),
      );
      recipient();
      await submitExisting();
      expect(await screen.findByText(heading)).toBeTruthy();
      expect(screen.queryByText(message)).toBeNull();
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
    expect(await screen.findByText("Setup result needs inspection")).toBeTruthy();
    expect(screen.queryByText("Disabled setup link")).toBeNull();
  });

  it("does not activate link-state copy for contradictory code/reason metadata", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("FORBIDDEN", {
        message: "This setup link is disabled.",
        data: { reason: "SETUP_LINK_DISABLED" },
      }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Setup result needs inspection")).toBeTruthy();
    expect(screen.queryByText("Disabled setup link")).toBeNull();
  });

  it("renders an unknown error safely, without leaking remote data", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { message: "postgres://private" }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Setup result needs inspection")).toBeTruthy();
    expect(screen.queryByText(/postgres/)).toBeNull();
  });
});
