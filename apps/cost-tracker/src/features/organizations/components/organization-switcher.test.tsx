import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(),
  reload: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: { setActive: mocks.setActive, checkRolePermission: () => true },
    useSession: () => ({
      data: { user: { id: "user" }, session: { activeOrganizationId: "org-a" } },
    }),
    useActiveOrganization: () => ({
      data: { id: "org-a", members: [{ userId: "user", role: "owner" }] },
    }),
  },
}));

vi.mock(
  "@/features/organizations/organization-switch",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/organizations/organization-switch")
    >()),
    reloadOrganizationPage: mocks.reload,
  }),
);

import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";
import { useParticipantEntryAccess } from "@/features/participant-onboarding/hooks/use-participant-entry-access";

const organizations = [
  { id: "org-a", name: "Alpha" },
  { id: "org-b", name: "Beta" },
];

function PartnerGate() {
  const access = useParticipantEntryAccess({
    userId: "user",
    partnerOrganizationId: "org-a",
    hostOrganizationId: "host",
    assignedCoordinator: true,
  });
  return (
    <div data-testid="partner-gate" data-permitted={String(access.permitted)} />
  );
}

function renderSwitcher() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OrganizationSwitcher
        activeOrganizationId="org-a"
        organizations={organizations}
      />
      <PartnerGate />
    </QueryClientProvider>,
  );
}

// Base UI composes the trigger through the shared Button primitive; that
// composition only answers a plain click event under jsdom, so the tests
// drive the real click handlers with fireEvent instead of userEvent.
function openMenu() {
  fireEvent.click(screen.getByTestId("organization-switcher"));
}

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setActive.mockResolvedValue({});
  });

  it("marks the current Organization explicitly", async () => {
    renderSwitcher();
    openMenu();

    const current = await screen.findByTestId("switch-organization-org-a");
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.querySelector("svg")).not.toBeNull();
    expect(
      screen
        .getByTestId("switch-organization-org-b")
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("switches through Better Auth and loads a fresh document", async () => {
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByTestId("switch-organization-org-b"));

    await waitFor(() => {
      expect(mocks.reload).toHaveBeenCalledOnce();
    });
    expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
      organizationId: "org-b",
    });
  });

  it("ignores selecting the current Organization", async () => {
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByTestId("switch-organization-org-a"));

    expect(mocks.setActive).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it("fails closed with safe feedback when switching rejects", async () => {
    mocks.setActive.mockRejectedValue(new Error("revoked"));
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByTestId("switch-organization-org-b"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveAttribute(
        "data-switch-status",
        "failed",
      );
    });
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it("blocks the partner gate while the shared switch mutation is pending", async () => {
    let finish!: (value: object) => void;
    mocks.setActive.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderSwitcher();
    expect(screen.getByTestId("partner-gate")).toHaveAttribute(
      "data-permitted",
      "true",
    );
    openMenu();
    fireEvent.click(await screen.findByTestId("switch-organization-org-b"));
    await waitFor(() =>
      expect(screen.getByTestId("partner-gate")).toHaveAttribute(
        "data-permitted",
        "false",
      ),
    );
    finish({ error: { message: "denied" } });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveAttribute(
        "data-switch-status",
        "failed",
      ),
    );
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it("keeps the gate closed after success while the old document is visible", async () => {
    renderSwitcher();
    openMenu();
    fireEvent.click(await screen.findByTestId("switch-organization-org-b"));
    await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    expect(screen.getByTestId("partner-gate")).toHaveAttribute(
      "data-permitted",
      "false",
    );
  });
});
