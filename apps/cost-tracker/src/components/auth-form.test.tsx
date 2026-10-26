import { ORPCError } from "@orpc/client";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

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

  it("keeps the direct invitation pointer and accessible personal login controls", () => {
    render(<AuthForm mode="sign-up" />);
    expect(screen.getByTestId("direct-invitation-pointer")).toBeVisible();
    for (const id of [
      "name",
      "email",
      "password",
      "google-sign-in",
      "auth-submit",
      "auth-account-navigation",
    ]) {
      expect(screen.getByTestId(id)).toHaveAccessibleName();
    }
    expect(screen.queryByTestId("create-organization")).not.toBeInTheDocument();
  });

  it("navigates once after sign-in without refreshing an in-flight Projects route", async () => {
    mocks.signIn.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthForm mode="sign-in" />);

    fireEvent.change(screen.getByTestId("email"), {
      target: { value: "user@example.org" },
    });
    fireEvent.change(screen.getByTestId("password"), {
      target: { value: "example-password" },
    });
    await user.click(screen.getByTestId("auth-submit"));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/projects"),
    );
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

      await user.type(screen.getByTestId("name"), "Alex Morgan");
      await user.type(screen.getByTestId("email"), "user@example.org");
      await user.type(screen.getByTestId("password"), "example-password");
      await user.click(screen.getByTestId("auth-submit"));

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

    await user.type(screen.getByTestId("email"), "user@example.org");
    await user.type(
      screen.getByTestId("password"),
      "correct-horse-battery-staple",
    );
    await user.click(screen.getByTestId("auth-submit"));

    expect(await screen.findByTestId("auth-form-error")).toBeVisible();
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
  await user.type(screen.getByTestId("email"), "user@example.org");
  await user.type(screen.getByTestId("password"), "example-password");
  await user.click(screen.getByTestId("auth-submit"));
  expect(await screen.findByTestId("auth-form-error")).toBeInTheDocument();
  expect(screen.queryByTestId("auth-verification-message")).toBeNull();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("renders the server receipt with named progress and destination-preserving sign-in", async () => {
  const invitation = {
    invitationId: "invite-1",
    organization: { id: "org-1", name: "Example Organization" },
  };
  const returnTo = "/accept-invitation/invite-1";
  mocks.signUp.mockResolvedValue({
    success: true,
    decision: {
      entryContext: "organization-invitation",
      nextStep: "verify-email",
      invitation,
      email: "submitted@example.org",
      availableActions: [{ kind: "authenticate", entry: "login", returnTo }],
    },
  });
  render(
    <AuthForm
      mode="sign-up"
      decision={{
        entryContext: "organization-invitation",
        nextStep: "authenticate",
        invitation,
        availableActions: [
          { kind: "authenticate", entry: "register", returnTo },
          { kind: "authenticate", entry: "login", returnTo },
          { kind: "google", returnTo },
        ],
      }}
    />,
  );
  expect(screen.getByTestId("email")).toHaveValue("");
  expect(screen.getByTestId("email")).not.toHaveAttribute("readonly");
  expect(screen.getByTestId("auth-account-navigation")).toHaveAttribute(
    "href",
    "/login?next=%2Faccept-invitation%2Finvite-1",
  );
  await userEvent.type(screen.getByTestId("name"), "Alex Morgan");
  await userEvent.type(screen.getByTestId("email"), "submitted@example.org");
  await userEvent.type(screen.getByTestId("password"), "example-password");
  await userEvent.click(screen.getByTestId("auth-submit"));
  expect(await screen.findByTestId("auth-verification-message")).toHaveAttribute(
    "role",
    "status",
  );
  expect(screen.getByTestId("invitation-context")).toHaveAttribute(
    "data-organization-id",
    "org-1",
  );
  expect(screen.getByRole("list")).toHaveAccessibleName();
  expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  expect(screen.getByTestId("verification-address")).toBeVisible();
  expect(screen.getByTestId("inbox-sign-in")).toHaveAttribute(
    "href",
    "/login?next=%2Faccept-invitation%2Finvite-1",
  );
  expect(screen.queryByTestId("create-organization")).toBeNull();
});
