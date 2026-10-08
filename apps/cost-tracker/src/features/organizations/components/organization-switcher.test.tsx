import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(),
  invalidateQueries: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher";

const organizations = [
  { id: "org-a", name: "Alpha" },
  { id: "org-b", name: "Beta" },
];

function renderSwitcher() {
  render(
    <OrganizationSwitcher
      activeOrganizationId="org-a"
      organizations={organizations}
    />,
  );
}

// Base UI composes the trigger through the shared Button primitive; that
// composition only answers a plain click event under jsdom, so the tests
// drive the real click handlers with fireEvent instead of userEvent.
function openMenu() {
  fireEvent.click(
    screen.getByRole("button", { name: /Acting Organization: Alpha/ }),
  );
}

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setActive.mockResolvedValue({});
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("marks the current Organization explicitly", async () => {
    renderSwitcher();
    openMenu();

    const current = await screen.findByRole("menuitem", { name: "Alpha" });
    expect(current.getAttribute("aria-current")).toBe("true");
    expect(current.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Beta" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("switches through Better Auth and refreshes scoped data", async () => {
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));

    await waitFor(() => {
      expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
        organizationId: "org-b",
      });
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("ignores selecting the current Organization", async () => {
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Alpha" }));

    expect(mocks.setActive).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("fails closed with safe feedback when switching rejects", async () => {
    mocks.setActive.mockRejectedValue(new Error("revoked"));
    renderSwitcher();
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not switch Organization. Try again.",
      );
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
