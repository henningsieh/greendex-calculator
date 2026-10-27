import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";
import { CheckInbox } from "@/features/authentication/components/check-inbox";
import { decideOnboarding } from "@/features/authentication/onboarding-decision";

const mocks = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: mocks }));
vi.mock("@/features/authentication/components/sign-out-button", () => ({
  SignOutButton: () => <button data-testid="sign-out" aria-label="sign-out" />,
}));

function renderInvitation(account: "unverified" | "verification-requested") {
  const decision = decideOnboarding({
    account,
    entryContext: "organization-invitation",
    authEntry: "register",
    returnTo: "/accept-invitation/invite-1",
    email: "submitted@example.org",
    entry: {
      kind: "organization-invitation",
      status: "pending",
      invitationId: "invite-1",
      organization: { id: "org-1", name: "Example Organization" },
    },
  });
  if (decision.nextStep !== "verify-email")
    throw new Error("unexpected decision");
  render(<CheckInbox email={decision.email} decision={decision} />);
}

describe("CheckInbox invitation resend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.sendVerificationEmail.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it.each(["unverified", "verification-requested"] as const)(
    "resends for %s with the invitation callback and a cooldown",
    async (account) => {
      let complete: (value: {
        data: { status: boolean };
        error: null;
      }) => void = () => {};
      mocks.sendVerificationEmail.mockImplementation(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      renderInvitation(account);
      const button = screen.getByTestId("inbox-resend-verification");
      expect(button).toHaveAccessibleName();
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", "true");
      fireEvent.click(button);
      expect(mocks.sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({
        email: "submitted@example.org",
        callbackURL: "/accept-invitation/invite-1",
      });
      await act(async () => complete({ data: { status: true }, error: null }));
      expect(screen.getByTestId("inbox-resend-result")).toHaveAttribute(
        "data-result",
        "success",
      );
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).toBeDisabled();
      void act(() => vi.advanceTimersByTime(30_000));
      expect(button).toBeEnabled();
      expect(
        screen.getByTestId(
          account === "unverified" ? "sign-out" : "inbox-sign-in",
        ),
      ).toBeInTheDocument();
    },
  );

  it.each(["returned", "thrown"] as const)(
    "reports %s failures safely and throttles retries",
    async (failure) => {
      if (failure === "returned")
        mocks.sendVerificationEmail.mockResolvedValue({
          error: { message: "private details" },
        });
      else
        mocks.sendVerificationEmail.mockRejectedValue(
          new Error("private details"),
        );
      renderInvitation("verification-requested");
      await act(async () =>
        fireEvent.click(screen.getByTestId("inbox-resend-verification")),
      );
      expect(screen.getByTestId("inbox-resend-result")).toHaveAttribute(
        "data-result",
        "error",
      );
      expect(screen.getByTestId("inbox-resend-verification")).toBeDisabled();
      void act(() => vi.advanceTimersByTime(30_000));
      expect(screen.getByTestId("inbox-resend-verification")).toBeEnabled();
    },
  );

  it.each(["direct", "partner-setup"] as const)(
    "does not expose resend for %s",
    (entryContext) => {
      const decision = decideOnboarding({
        account: "unverified",
        entryContext,
        email: "submitted@example.org",
      });
      if (decision.nextStep !== "verify-email")
        throw new Error("unexpected decision");
      render(<CheckInbox email={decision.email} decision={decision} />);
      expect(screen.getByTestId("auth-verification-message")).toBeInTheDocument();
      expect(
        screen.queryByTestId("inbox-resend-verification"),
      ).not.toBeInTheDocument();
    },
  );
});
