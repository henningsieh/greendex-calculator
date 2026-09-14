import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  toastAdd: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { add: mocks.toastAdd },
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { authentication: { signOut: mocks.signOut } },
}));

import { SignOutButton } from "@/features/authentication/components/sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.toastAdd.mockReset();
  });

  it("keeps the control usable and reports a rejected sign-out request safely", async () => {
    mocks.signOut.mockRejectedValue(new Error("network unavailable"));
    const user = userEvent.setup();
    render(<SignOutButton />);

    const button = screen.getByRole("button", { name: "Sign out" });
    await user.click(button);

    expect(await screen.findByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(mocks.toastAdd).toHaveBeenCalledWith({
      description:
        "The server or network is unreachable. Check your connection and try again.",
      title: "Could not sign out",
      type: "error",
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
