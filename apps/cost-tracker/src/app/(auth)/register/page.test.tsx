import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  next: vi.fn(),
  session: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { authentication: { onboardingNextStep: mocks.next } },
}));
vi.mock("@/lib/session", async (original) => ({
  ...(await original<typeof import("@/lib/session")>()),
  getSession: mocks.session,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: {} }));

import RegisterPage from "@/app/(auth)/register/page";

beforeEach(() => vi.clearAllMocks());

it.each([false, true])(
  "keeps malformed invitation registration in recovery with signed-in state %s",
  async (signedIn) => {
    mocks.session.mockResolvedValue(
      signedIn ? { user: { id: "verified" } } : null,
    );
    mocks.next.mockResolvedValue({
      entryContext: "organization-invitation",
      nextStep: signedIn ? "invitation-recovery" : "authenticate",
      ...(signedIn
        ? {
            reason: "STAFF_INVITATION_NOT_FOUND",
            availableActions: [{ kind: "sign-out" }, { kind: "recheck" }],
          }
        : { availableActions: [{ kind: "authenticate" }] }),
    });
    render(
      await RegisterPage({
        searchParams: Promise.resolve({ next: "/accept-invitation/bad!" }),
      }),
    );
    expect(
      document.querySelector(
        '[data-invitation-recovery="STAFF_INVITATION_NOT_FOUND"]',
      ),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.next).toHaveBeenCalledWith({
      returnTo: "/accept-invitation/bad!",
    });
  },
);
