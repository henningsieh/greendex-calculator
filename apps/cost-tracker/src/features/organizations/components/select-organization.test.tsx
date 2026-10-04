import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setActive: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { setActive: mocks.setActive } },
}));

vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { SelectOrganization } from "@/features/organizations/components/select-organization";

const organizations = [
  { id: "org-a", name: "Alpha" },
  { id: "org-b", name: "Beta" },
];

describe("SelectOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setActive.mockResolvedValue({});
  });

  it("lists eligible Memberships without staff actions or redirects", () => {
    render(<SelectOrganization organizations={organizations} />);

    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
  });

  it("re-anchors the session and refreshes the shell on selection", async () => {
    const user = userEvent.setup();
    render(<SelectOrganization organizations={organizations} />);

    await user.click(screen.getByRole("button", { name: "Beta" }));

    await waitFor(() => {
      expect(mocks.setActive).toHaveBeenCalledExactlyOnceWith({
        organizationId: "org-b",
      });
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("fails closed with safe feedback when selection rejects", async () => {
    mocks.setActive.mockRejectedValue(new Error("revoked meanwhile"));
    const user = userEvent.setup();
    render(<SelectOrganization organizations={organizations} />);

    await user.click(screen.getByRole("button", { name: "Beta" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not select that Organization.",
      );
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
