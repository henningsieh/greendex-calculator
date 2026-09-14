import { ORPCError } from "@orpc/client";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  startGoogleSignIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("@/lib/orpc/orpc", () => ({
  orpc: {
    authentication: {
      signIn: mocks.signIn,
      signUp: mocks.signUp,
      startGoogleSignIn: mocks.startGoogleSignIn,
    },
  },
}));

import { AuthForm } from "@/components/auth-form";

describe("AuthForm", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.signIn.mockReset();
    mocks.signUp.mockReset();
    mocks.startGoogleSignIn.mockReset();
  });

  it("shows the safe rate-limit message returned by its oRPC command", async () => {
    mocks.signIn.mockRejectedValue(new ORPCError("TOO_MANY_REQUESTS"));
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);

    await user.type(screen.getByLabelText("Email address"), "user@example.org");
    await user.type(
      screen.getByLabelText("Password"),
      "correct-horse-battery-staple",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "Too many requests were sent. Wait a moment and try again.",
      ),
    ).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
