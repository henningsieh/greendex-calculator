import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: { createOrganization: mocks.createOrganization },
  },
}));

vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

import { NoOrganizationAccess } from "@/features/authentication/components/no-organization-access";

describe("NoOrganizationAccess", () => {
  beforeEach(() => {
    mocks.createOrganization.mockReset();
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
  });

  it("clears pending state and gives safe feedback when Organization creation rejects", async () => {
    mocks.createOrganization.mockRejectedValue(new Error("network unavailable"));
    const user = userEvent.setup();
    render(<NoOrganizationAccess autoOpen />);

    await user.type(screen.getByLabelText("Organization name"), "Northwind");
    await user.click(screen.getByRole("button", { name: "Create Organization" }));

    expect(
      await screen.findByText(
        "The server or network is unreachable. Check your connection and try again.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create Organization" }),
    ).not.toBeDisabled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
