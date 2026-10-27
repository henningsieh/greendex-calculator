import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

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

  it("does not sign out when cancelled and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByTestId("sign-out"));
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-cancel"),
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("sign-out")).toHaveFocus());
    expect(screen.getByTestId("sign-out")).toBeEnabled();
  });

  it("closes before requesting sign-out and disables the trigger until completion", async () => {
    mocks.signOut.mockImplementation(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      return new Promise(() => {});
    });
    const user = userEvent.setup();
    render(<SignOutButton />);
    await user.click(screen.getByTestId("sign-out"));
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );
    expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getByTestId("sign-out")).toBeDisabled();
  });

  it("navigates once after sign-out", async () => {
    mocks.signOut.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByTestId("sign-out"));
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("keeps the control usable and reports a rejected sign-out request safely", async () => {
    mocks.signOut.mockRejectedValue(new Error("network unavailable"));
    const user = userEvent.setup();
    render(<SignOutButton />);

    const button = screen.getByTestId("sign-out");
    await user.click(button);
    await user.click(
      within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
    );

    expect(await screen.findByTestId("sign-out")).toBeEnabled();
    expect(mocks.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

it("returns invitation sign-out to the retained journey", async () => {
  mocks.signOut.mockResolvedValue({});
  render(
    <SignOutButton destination="/register?next=%2Faccept-invitation%2Finvite-1" />,
  );
  await userEvent.click(screen.getByTestId("sign-out"));
  await userEvent.click(
    within(screen.getByRole("dialog")).getByTestId("confirm-dialog-execute"),
  );
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
    "/register?next=%2Faccept-invitation%2Finvite-1",
  );
});
