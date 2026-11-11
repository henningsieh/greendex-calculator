import { ORPCError } from "@orpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { createQueryClient } from "@/lib/tanstack-react-query/client";
import german from "@/messages/de/apiErrors.json";
import english from "@/messages/en/apiErrors.json";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  create: vi.fn(),
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
        createSetupLink: mocks.create,
      },
    },
  };
});

import { AssignOrganizationDialog } from "@/features/partnerships/components/project-partnership-assigner";
import { CreateSetupLinkDialog } from "@/features/partnerships/components/setup-link";
import { orpcQuery } from "@/lib/orpc/orpc";

async function renderDialog(
  locale: "en" | "de" = "en",
  projects = [{ id: "project-new", name: "New Project" }],
  organizations = [{ id: "organization-new", name: "New Partner" }],
) {
  const queryClient = createQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <AssignOrganizationDialog
        projects={projects}
        organizations={organizations}
      />
    </QueryClientProvider>,
    { locale },
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
  expect(screen.getByRole("option")).toBeVisible();
  await user.type(await screen.findByTestId("entity-search"), "N");
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

  it.each(["en", "de"] as const)(
    "translates required fields in %s and blocks assignment",
    async (locale) => {
      const user = userEvent.setup();
      await renderDialog(locale);
      await user.click(screen.getByTestId("assign-partnership"));
      const dialog = within(screen.getByTestId("organization-assignment"));
      const details = (locale === "de" ? german : english).apiErrors.details;
      await waitFor(() =>
        expect(
          within(dialog.getByTestId("hosted-project-picker")).getByTestId(
            "entity-combobox-trigger",
          ),
        ).toHaveAccessibleDescription(details.projectIdRequired),
      );
      expect(
        within(dialog.getByTestId("partner-organization-picker")).getByTestId(
          "entity-combobox-trigger",
        ),
      ).toHaveAccessibleDescription(details.organizationIdRequired);
      expect(mocks.assign).not.toHaveBeenCalled();
    },
  );

  it.each(["en", "de"] as const)(
    "blocks overlong identifiers in %s",
    async (locale) => {
      const user = userEvent.setup();
      await renderDialog(
        locale,
        [{ id: "p".repeat(129), name: "New Project" }],
        [{ id: "o".repeat(129), name: "New Partner" }],
      );
      await selectAssignment(user);
      await user.click(screen.getByTestId("assign-partnership"));
      const dialog = within(screen.getByTestId("organization-assignment"));
      const details = (locale === "de" ? german : english).apiErrors.details;
      await waitFor(() =>
        expect(
          within(dialog.getByTestId("hosted-project-picker")).getByTestId(
            "entity-combobox-trigger",
          ),
        ).toHaveAccessibleDescription(details.projectIdTooLong),
      );
      expect(
        within(dialog.getByTestId("partner-organization-picker")).getByTestId(
          "entity-combobox-trigger",
        ),
      ).toHaveAccessibleDescription(details.organizationIdTooLong);
      expect(mocks.assign).not.toHaveBeenCalled();
    },
  );

  it("places cancel and submit in one right-aligned row", async () => {
    await renderDialog();
    const submit = screen.getByTestId("assign-partnership");
    const footer = submit.closest<HTMLElement>('[data-slot="dialog-footer"]')!;
    expect(footer).toHaveClass("flex-row", "justify-end");
    expect(within(footer).getAllByRole("button")).toEqual([
      footer.querySelector('button[type="button"]'),
      submit,
    ]);
  });

  it("shows every organization immediately and filters from one character", async () => {
    const user = userEvent.setup();
    const organizations = Array.from({ length: 25 }, (_, i) => ({
      id: `id-${i}`,
      name: `Partner ${i}`,
    }));
    organizations.push({ id: "zebra-id", name: "Distinct" });
    await renderDialog("en", undefined, organizations);
    const picker = within(screen.getByTestId("partner-organization-picker"));
    await user.click(picker.getByTestId("entity-combobox-trigger"));
    expect(screen.getAllByRole("option")).toHaveLength(26);
    await user.type(screen.getByTestId("entity-search"), "z");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveAttribute(
      "data-entity-id",
      "zebra-id",
    );
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

  it("keeps project selections independent when both dialogs share the same options", async () => {
    const user = userEvent.setup();
    const projects = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ];
    mocks.create.mockResolvedValue({ id: "link-1", secret: "secret" });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CreateSetupLinkDialog projects={projects} />
        <AssignOrganizationDialog
          projects={projects}
          organizations={[{ id: "organization-new", name: "New Partner" }]}
        />
      </QueryClientProvider>,
    );
    await user.click(screen.getByTestId("assign-organization"));
    let dialog = within(screen.getByTestId("organization-assignment"));
    await user.click(
      within(dialog.getByTestId("hosted-project-picker")).getByTestId(
        "entity-combobox-trigger",
      ),
    );
    await user.click(screen.getByTestId("entity-option-a"));
    await user.click(
      dialog
        .getAllByRole("button")
        .find(
          (button) =>
            button.closest('[data-slot="dialog-footer"]') &&
            button.getAttribute("type") === "button",
        )!,
    );
    await user.click(screen.getByTestId("new-setup-link"));
    const setup = within(screen.getByTestId("setup-link-creator"));
    await user.click(
      within(setup.getByTestId("hosted-project-picker")).getByTestId(
        "entity-combobox-trigger",
      ),
    );
    await user.click(screen.getByTestId("entity-option-b"));
    await user.type(setup.getByTestId("setup-email"), "test@example.org");
    await user.click(setup.getByTestId("create-setup-link"));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        projectId: "b",
        recipientEmail: "test@example.org",
      }),
    );
    await user.click(
      setup
        .getAllByRole("button")
        .find(
          (button) =>
            button.closest('[data-slot="dialog-footer"]') &&
            button.getAttribute("type") === "button",
        )!,
    );
    await user.click(screen.getByTestId("assign-organization"));
    dialog = within(screen.getByTestId("organization-assignment"));
    await user.click(
      within(dialog.getByTestId("partner-organization-picker")).getByTestId(
        "entity-combobox-trigger",
      ),
    );
    await user.click(screen.getByTestId("entity-option-organization-new"));
    await user.click(dialog.getByTestId("assign-partnership"));
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith({
        projectId: "a",
        organizationId: "organization-new",
      }),
    );
  });

  it("trims selected identifiers and resets after a successful assignment", async () => {
    const user = userEvent.setup();
    await renderDialog(
      "en",
      [{ id: " project-new ", name: "New Project" }],
      [{ id: " organization-new ", name: "New Partner" }],
    );
    await selectAssignment(user);
    await user.click(screen.getByTestId("assign-partnership"));
    await waitFor(() =>
      expect(mocks.assign).toHaveBeenCalledWith({
        projectId: "project-new",
        organizationId: "organization-new",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId("organization-assignment"),
      ).not.toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("assign-organization"));
    await user.click(screen.getByTestId("assign-partnership"));
    await waitFor(() =>
      expect(
        within(screen.getByTestId("hosted-project-picker")).getByTestId(
          "entity-combobox-trigger",
        ),
      ).toHaveAccessibleDescription(english.apiErrors.details.projectIdRequired),
    );
    expect(
      within(screen.getByTestId("partner-organization-picker")).getByTestId(
        "entity-combobox-trigger",
      ),
    ).toHaveAccessibleDescription(
      english.apiErrors.details.organizationIdRequired,
    );
    expect(mocks.assign).toHaveBeenCalledOnce();
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
