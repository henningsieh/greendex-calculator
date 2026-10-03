import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/tanstack-react-query/client";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  consume: vi.fn(),
  writeText: vi.fn(),
  searchHosted: vi.fn(),
  listMine: vi.fn(),
  listSetupLinks: vi.fn(),
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
        createSetupLink: mocks.create,
        consumeSetupLink: mocks.consume,
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
  vi.clearAllMocks();
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
  return render(<SetupLinkRecipient id="link-1" secret={secret} />);
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
  await user.click(screen.getByRole("radio", { name: "Existing Organization" }));
  await selectOption(user, "Organization", "My Organization");
  await user.click(screen.getByRole("button", { name: "Complete setup" }));
}

describe("Setup Link UI", () => {
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
    render(<SetupLinkRecipient id="link-1" />);
    expect(screen.getByText("Invalid setup link")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete setup" })).toBeNull();
  });

  it("renders new Organization setup and never claims Hosting membership", async () => {
    recipient();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("New Organization name"),
      "New Partner",
    );
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organization: { kind: "new", name: "New Partner" },
    });
    expect(await screen.findByText("Project Partnership created")).toBeTruthy();
    expect(
      screen.getByText(/does not grant Hosting Organization membership/i),
    ).toBeTruthy();
  });

  it("shows Owner verification on the existing path and sends the ID for server verification", async () => {
    recipient();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("radio", { name: "Existing Organization" }),
    );
    expect(screen.getByText(/verified by the server/i)).toBeTruthy();
    await selectOption(user, "Organization", "My Organization");
    expect(mocks.listMine).toHaveBeenCalledWith({ search: "My Organization" });
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(mocks.consume).toHaveBeenCalledWith({
      id: "link-1",
      secret: "private-secret",
      organization: { kind: "existing", organizationId: "partner-1" },
    });
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
    expect(await screen.findByText("Could not complete setup")).toBeTruthy();
    expect(screen.queryByText("Disabled setup link")).toBeNull();
  });

  it("does not activate link-state copy for contradictory status metadata", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("BAD_REQUEST", {
        status: 403,
        message: "This setup link is disabled.",
        data: { reason: "SETUP_LINK_DISABLED" },
      }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Could not complete setup")).toBeTruthy();
    expect(screen.queryByText("Disabled setup link")).toBeNull();
  });

  it("renders an unknown error safely, without leaking remote data", async () => {
    mocks.consume.mockRejectedValue(
      new ORPCError("BAD_REQUEST", { message: "postgres://private" }),
    );
    recipient();
    await submitExisting();
    expect(await screen.findByText("Could not complete setup")).toBeTruthy();
    expect(screen.queryByText(/postgres/)).toBeNull();
  });
});
