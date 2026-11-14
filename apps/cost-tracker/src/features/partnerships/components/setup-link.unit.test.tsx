import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";
import german from "@/messages/de/apiErrors.json";
import english from "@/messages/en-GB/apiErrors.json";

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
  toastAdd: vi.fn(),
}));
vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
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
  CreateSetupLinkDialog,
  SetupLinkList,
} from "@/features/partnerships/components/setup-link";

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

function page(
  locale: "en-GB" | "de" = "en-GB",
  projects = [{ id: "project-1", name: "Hosted Example" }],
) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <CreateSetupLinkDialog projects={projects} />
      <SetupLinkList />
    </QueryClientProvider>,
    { locale },
  );
}

function listOnly(locale: "en-GB" | "de" = "en-GB") {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <SetupLinkList />
    </QueryClientProvider>,
    { locale },
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("new-setup-link"));
  return within(screen.getByTestId("setup-link-creator"));
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
    listOnly();
    await screen.findByRole("table");
    expect(
      document.querySelector(
        '[data-setup-link-id="expired-link"] [data-link-status]',
      ),
    ).toHaveAttribute("data-link-status", "expired");
  });

  it("places cancel and submit in one right-aligned row", async () => {
    const user = userEvent.setup();
    page();
    const dialog = await openDialog(user);
    const submit = dialog.getByTestId("create-setup-link");
    const footer = submit.closest<HTMLElement>('[data-slot="dialog-footer"]')!;
    expect(footer).toHaveClass("flex-row", "justify-end");
    expect(within(footer).getAllByRole("button")).toEqual([
      footer.querySelector('button[type="button"]'),
      submit,
    ]);
  });

  it("creates a recipient-bound link, displays it and copies the URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(
      mocks.writeText,
    );
    mocks.searchHosted.mockResolvedValue([
      { id: " project-1 ", name: "Hosted Example" },
    ]);
    page("en-GB", [{ id: " project-1 ", name: "Hosted Example" }]);
    const dialog = await openDialog(user);
    await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(dialog.getByTestId("entity-combobox-trigger"));
    expect(screen.getByRole("option")).toBeVisible();
    await user.type(screen.getByTestId("entity-search"), "H");
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(dialog.getByTestId("setup-email"), "Partner@Example.com");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenCalledWith({
      projectId: "project-1",
      recipientEmail: "partner@example.com",
    });
    const url = dialog.getByTestId("recipient-link");
    const urlText = url instanceof HTMLOutputElement ? url.value : "";
    expect(urlText).toContain("/setup-links/link-1?secret=private-secret");
    const copyButton = dialog.getByTestId("copy-setup-link");
    expect(copyButton).toHaveAccessibleName("Copy");
    await user.click(copyButton);
    expect(mocks.writeText).toHaveBeenCalledWith(urlText);
    expect(mocks.toastAdd).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ type: "success" }),
    );
  });

  it.each(["en-GB", "de"] as const)(
    "translates invalid setup fields in %s",
    async (locale) => {
      const user = userEvent.setup();
      const details = (locale === "de" ? german : english).apiErrors.details;
      page(locale);
      const dialog = await openDialog(user);
      await user.click(dialog.getByTestId("create-setup-link"));
      await waitFor(() =>
        expect(
          dialog.getByTestId("entity-combobox-trigger"),
        ).toHaveAccessibleDescription(details.projectIdRequired),
      );
      expect(dialog.getByTestId("setup-email")).toHaveAccessibleDescription(
        details.emailRequired,
      );
      expect(dialog.getByTestId("setup-email")).toHaveAttribute(
        "aria-describedby",
        "setup-email-error",
      );
      expect(dialog.getByTestId("entity-combobox-trigger")).toHaveAttribute(
        "aria-describedby",
        "setup-project-error",
      );
      expect(mocks.create).not.toHaveBeenCalled();
      await user.type(dialog.getByTestId("setup-email"), "not-an-email");
      await user.click(dialog.getByTestId("create-setup-link"));
      await waitFor(() =>
        expect(dialog.getByTestId("setup-email")).toHaveAccessibleDescription(
          details.emailInvalid,
        ),
      );
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it.each(["en-GB", "de"] as const)(
    "shows a translated Project field error and refuses an overlong ID in %s",
    async (locale) => {
      const user = userEvent.setup();
      mocks.searchHosted.mockResolvedValue([
        { id: "x".repeat(129), name: "Hosted Example" },
      ]);
      page(locale, [{ id: "x".repeat(129), name: "Hosted Example" }]);
      const dialog = await openDialog(user);
      await user.click(dialog.getByTestId("entity-combobox-trigger"));
      await user.type(screen.getByTestId("entity-search"), "Host");
      await user.click(await screen.findByRole("option"));
      await user.type(dialog.getByTestId("setup-email"), "partner@example.com");
      await user.click(dialog.getByTestId("create-setup-link"));
      await waitFor(() =>
        expect(dialog.getByTestId("hosted-project-picker")).toHaveAttribute(
          "data-invalid",
          "true",
        ),
      );
      expect(
        dialog.getByTestId("entity-combobox-trigger"),
      ).toHaveAccessibleDescription(
        (locale === "de" ? german : english).apiErrors.details.projectIdTooLong,
      );
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it.each(["en-GB", "de"] as const)(
    "shows the copy fallback alert in %s when the clipboard write fails",
    async (locale) => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
        new Error("denied"),
      );
      page(locale as "en-GB" | "de");
      const dialog = await openDialog(user);
      await waitFor(() => expect(mocks.listSetupLinks).toHaveBeenCalledTimes(1));
      await user.click(dialog.getByTestId("entity-combobox-trigger"));
      await user.type(screen.getByTestId("entity-search"), "Host");
      await user.click(await screen.findByRole("option"));
      await user.type(dialog.getByTestId("setup-email"), "partner@example.com");
      await user.click(dialog.getByTestId("create-setup-link"));
      await within(screen.getByTestId("setup-link-creator")).findByTestId(
        "recipient-link",
      );
      await user.click(dialog.getByTestId("copy-setup-link"));
      await waitFor(() =>
        expect(
          within(screen.getByTestId("setup-link-creator")).getByRole("alert"),
        ).toBeVisible(),
      );
    },
  );

  it("prevents repeat issuance while the new link is pending", async () => {
    const user = userEvent.setup();
    mocks.create.mockReturnValue(new Promise(() => {}));
    page();
    const dialog = await openDialog(user);
    await user.click(dialog.getByTestId("entity-combobox-trigger"));
    await user.type(screen.getByTestId("entity-search"), "Host");
    const projectOption = await screen.findByRole("option");
    expect(projectOption).toHaveAttribute("data-value", "project-1");
    await user.click(projectOption);
    await user.type(dialog.getByTestId("setup-email"), "partner@example.com");
    const submit = dialog.getByTestId("create-setup-link");
    await user.click(submit);
    expect(submit).toBeDisabled();
  });
});
