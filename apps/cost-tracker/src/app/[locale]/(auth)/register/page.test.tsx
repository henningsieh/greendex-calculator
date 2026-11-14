import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithMessages as render } from "@/__tests__/render-with-messages";

const mocks = vi.hoisted(() => ({
  next: vi.fn(),
  session: vi.fn(),
  redirect: vi.fn(),
}));
// next-intl's navigation reads these from next/navigation at import time.
vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
  redirect: mocks.redirect,
  usePathname: () => "/login",
  useRouter: () => ({ refresh: vi.fn(), replace: mocks.redirect, push: vi.fn() }),
}));
vi.mock("@/lib/orpc/orpc", () => ({
  orpc: { authentication: { onboardingNextStep: mocks.next } },
}));
vi.mock("@/lib/session", async (original) => ({
  ...(await original<typeof import("@/lib/session")>()),
  getSession: mocks.session,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: {} }));

import LocalizedLoginPage from "@/app/[locale]/(auth)/login/page";
import LocalizedRegisterPage from "@/app/[locale]/(auth)/register/page";

beforeEach(() => vi.clearAllMocks());

describe.each([
  ["localized register", "register", LocalizedRegisterPage],
  ["localized login", "login", LocalizedLoginPage],
])("Authentication route (%s)", (_label, authEntry, RegisterPage) => {
  it.each([
    {
      label: "valid invitation",
      next: "/accept-invitation/invite_123",
      expected: "/accept-invitation/invite_123",
    },
    { label: "empty string", next: "", expected: "" },
    { label: "schema limit", next: "a".repeat(2048), expected: "a".repeat(2048) },
    { label: "over schema limit", next: "a".repeat(2049), expected: undefined },
    {
      label: "array",
      next: ["/accept-invitation/invite_123"],
      expected: "/accept-invitation",
    },
    { label: "missing value", next: undefined, expected: undefined },
  ])(
    "bounds the $label before resolving onboarding",
    async ({ next, expected }) => {
      mocks.session.mockResolvedValue(null);
      mocks.next.mockResolvedValue({
        entryContext: "direct",
        nextStep: "authenticate",
      });
      await RegisterPage({
        params: Promise.resolve({ locale: "en-GB" }),
        searchParams: Promise.resolve({ next }),
      });
      expect(mocks.next).toHaveBeenCalledExactlyOnceWith({
        returnTo: expected,
        authEntry,
      });
    },
  );

  it.each([false, true])(
    "keeps malformed invitation registration in recovery with signed-in state %s",
    async (signedIn) => {
      mocks.session.mockResolvedValue(
        signedIn ? { user: { id: "verified" } } : null,
      );
      mocks.next.mockResolvedValue({
        entryContext: "organization-invitation",
        nextStep: "invitation-recovery",
        reason: "STAFF_INVITATION_NOT_FOUND",
        returnTo: "/accept-invitation",
        availableActions: signedIn
          ? [
              { kind: "sign-out", destination: "/accept-invitation" },
              { kind: "recheck" },
            ]
          : [{ kind: "recheck" }],
      });
      render(
        await RegisterPage({
          params: Promise.resolve({ locale: "en-GB" }),
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
        authEntry,
      });
    },
  );
});
