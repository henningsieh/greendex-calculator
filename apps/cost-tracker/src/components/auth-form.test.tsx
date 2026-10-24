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

      const instruction = await screen.findByTestId("auth-verification-message");
      expect(instruction).toBeVisible();
      expect(instruction).toHaveAttribute("role", "status");
      expect(instruction).toHaveAttribute("data-emphasis", "prominent");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
      expect(instruction.querySelector("strong")).toBeVisible();
      expect(mocks.signUp).toHaveBeenCalledExactlyOnceWith({
        name: "Alex Morgan",
        email: "user@example.org",
        password: "example-password",
        returnTo,
      });
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

  it("keeps rate-limited sign-in on the form with an inline error", async () => {
    mocks.signIn.mockRejectedValue(new ORPCError("TOO_MANY_REQUESTS"));
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);

    await user.type(screen.getByLabelText("Email address"), "user@example.org");
    await user.type(
      screen.getByLabelText("Password"),
      "correct-horse-battery-staple",
    );
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByTestId("auth-form-error")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

it.each([
  createSituationErrors().invalidCredentials(),
  createSituationErrors().unauthenticated(),
  createSituationErrors().verifyEmail(),
])("renders an inline error for $data.reason", async (error) => {
  mocks.signIn.mockRejectedValue(error);
  const user = userEvent.setup();
  render(<AuthForm mode="sign-in" />);
  await user.type(screen.getByLabelText("Email address"), "user@example.org");
  await user.type(screen.getByLabelText("Password"), "example-password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByTestId("auth-form-error")).toBeInTheDocument();
  expect(screen.queryByTestId("auth-verification-message")).toBeNull();
  expect(mocks.replace).not.toHaveBeenCalled();
});
