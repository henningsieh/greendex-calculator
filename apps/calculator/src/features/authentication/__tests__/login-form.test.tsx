import { NextIntlClientProvider } from "@greendex/i18n/client";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/features/authentication/components/login-form";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/better-auth/auth-client", () => ({
  authClient: {
    getLastUsedLoginMethod: () => null,
    signIn: { email: signIn, magicLink: signIn },
  },
}));
vi.mock("@/lib/i18n/routing", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/features/authentication/components/social-buttons", () => ({
  SocialButtons: () => null,
}));
vi.mock("@/features/authentication/components/auth-flow-layout", () => ({
  normalizeRedirectPath: (_path: unknown, fallback: string) => fallback,
}));

describe("LoginForm", () => {
  it("renders field validation in both locales without signing in", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(
          <NextIntlClientProvider locale="en" messages={en}>
            <LoginForm />
          </NextIntlClientProvider>,
        ),
      );
      const form = container.querySelector("form");
      expect(form).not.toBeNull();
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
      await act(async () =>
        form?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2);
      expect(
        container.querySelectorAll('input[aria-invalid="true"]'),
      ).toHaveLength(2);
      expect(signIn).not.toHaveBeenCalled();
      await act(async () =>
        root.render(
          <NextIntlClientProvider locale="de" messages={de}>
            <LoginForm />
          </NextIntlClientProvider>,
        ),
      );
      await act(async () =>
        form?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        ),
      );
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(2);
      expect(
        container.querySelectorAll('input[aria-invalid="true"]'),
      ).toHaveLength(2);
      expect(signIn).not.toHaveBeenCalled();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
