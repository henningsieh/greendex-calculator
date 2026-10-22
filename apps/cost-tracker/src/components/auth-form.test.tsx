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
import { createSituationErrors } from "@/lib/orpc/errors";

describe("AuthForm", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.replace.mockReset();
    mocks.signIn.mockReset();
    mocks.signUp.mockReset();
    mocks.startGoogleSignIn.mockReset();
  });

  it("navigates once after sign-in without refreshing an in-flight Projects route", async () => {
    mocks.signIn.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);

    await user.type(screen.getByLabelText("Email address"), "user@example.org");
    await user.type(screen.getByLabelText("Password"), "example-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/projects");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "/accept-invitation/invite_123",
    "/setup-links/setup_123?secret=abc_DEF-123",
  ])(
    "preserves signup destination %s and shows verification instructions without navigating",
    async (returnTo) => {
      mocks.signUp.mockResolvedValue({});
      const user = userEvent.setup();
      render(<AuthForm mode="sign-up" returnTo={returnTo} />);

      await user.type(screen.getByLabelText("Name"), "Alex Morgan");
      await user.type(screen.getByLabelText("Email address"), "user@example.org");
      await user.type(screen.getByLabelText("Password"), "example-password");
      await user.click(screen.getByRole("button", { name: "Create account" }));

      expect(
        await screen.findByText(
          "Check your inbox. The verification link will sign you in and take you back to Cost Tracker.",
        ),
      ).toBeTruthy();
      expect(mocks.signUp).toHaveBeenCalledExactlyOnceWith({
        name: "Alex Morgan",
        email: "user@example.org",
        password: "example-password",
        returnTo,
      });
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

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

it.each([
  [createSituationErrors().invalidCredentials(), "Incorrect email or password."],
  [
    createSituationErrors().unauthenticated(),
    "Your session is missing or has expired. Sign in to continue.",
  ],
  [createSituationErrors().verifyEmail(), "Verify your email before continuing."],
])(
  "renders credential/session/verification distinction $data.reason",
  async (error, text) => {
    mocks.signIn.mockRejectedValue(error);
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);
    await user.type(screen.getByLabelText("Email address"), "user@example.org");
    await user.type(screen.getByLabelText("Password"), "example-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByText("private SQL token")).toBeNull();
  },
);
