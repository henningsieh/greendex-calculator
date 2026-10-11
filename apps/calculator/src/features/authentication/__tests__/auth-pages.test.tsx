import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "@/app/[locale]/(auth)/forgot-password/page";
import LoginPage from "@/app/[locale]/(auth)/login/page";
import ResetPasswordPage from "@/app/[locale]/(auth)/reset-password/page";
import SignupPage from "@/app/[locale]/(auth)/signup/page";
import VerifyEmailPage from "@/app/[locale]/(auth)/verify-email/page";
import { LOGIN_PATH } from "@/app/routes";

const mocks = vi.hoisted(() => ({
  translate: vi.fn((key: string) => `translated:${key}`),
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@greendex/i18n/server", () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));
vi.mock("@/lib/i18n/routing", () => ({ redirect: mocks.redirect }));
vi.mock("@/features/authentication/components/auth-flow-layout", () => ({
  default: ({
    children,
    locale,
    backHref,
    backLabel,
  }: {
    children: ReactNode;
    locale: string;
    backHref?: string;
    backLabel?: string;
  }) => (
    <section lang={locale}>
      <a href={backHref}>{backLabel}</a>
      {children}
    </section>
  ),
}));
vi.mock("@/features/authentication/components/login-form", () => ({
  LoginForm: ({ nextPageUrl }: { nextPageUrl?: string | string[] }) => (
    <output data-form="login">{JSON.stringify({ nextPageUrl })}</output>
  ),
}));
vi.mock("@/features/authentication/components/signup-form", () => ({
  SignupForm: ({ nextPageUrl }: { nextPageUrl?: string | string[] }) => (
    <output data-form="signup">{JSON.stringify({ nextPageUrl })}</output>
  ),
}));
vi.mock("@/features/authentication/components/reset-password-form", () => ({
  ResetPasswordForm: ({ token }: { token: string }) => (
    <output data-form="reset">{token}</output>
  ),
}));
vi.mock("@/features/authentication/components/forgot-password-form", () => ({
  ForgotPasswordForm: () => <output>forgot password</output>,
}));
vi.mock("@/features/authentication/components/verify-email-content", () => ({
  VerifyEmailContent: () => <output>verify email</output>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue(mocks.translate);
  mocks.redirect.mockImplementation(() => {
    throw new Error("redirect");
  });
});

type SearchParams = Record<string, string | string[] | undefined>;

async function renderContent(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  const container = document.createElement("div");
  container.innerHTML = await new Response(stream).text();
  return container;
}

describe.each([
  ["login", LoginPage],
  ["signup", SignupPage],
] as const)("%s page", (name, Page) => {
  it.each([undefined, "", "/org/projects?archived=true", ["/first", "/second"]])(
    "preserves nextPageUrl %j for the form",
    async (nextPageUrl) => {
      const html = await renderContent(
        Page({
          params: Promise.resolve({ locale: "de" }),
          searchParams: Promise.resolve({ nextPageUrl }),
        }),
      );
      expect(html.querySelector("section")?.lang).toBe("de");
      expect(html.querySelector(`[data-form="${name}"]`)?.textContent).toBe(
        JSON.stringify({ nextPageUrl }),
      );
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
});

describe("deferred auth forms", () => {
  it.each([
    ["login", LoginPage],
    ["signup", SignupPage],
    ["reset", ResetPasswordPage],
  ] as const)(
    "renders the %s shell before query parameters resolve",
    async (name, Page) => {
      const deferred = Promise.withResolvers<SearchParams>();
      // If the page itself starts awaiting searchParams, this bounded test fails
      // before it can release the promise. No timers simulate request progress.
      const page = Page({
        params: Promise.resolve({ locale: "fr" }),
        searchParams: deferred.promise,
      });
      const stream = await renderToReadableStream(page);
      const reader = stream.getReader();
      let remainder = "";
      try {
        const first = await reader.read();
        const shell = new TextDecoder().decode(first.value);
        expect(shell).toContain('lang="fr"');
        expect(shell).toContain('data-testid="auth-form-skeleton"');
        expect(shell).toContain('aria-hidden="true"');
        expect(shell).not.toContain(`data-form="${name}"`);
        expect(mocks.redirect).not.toHaveBeenCalled();
      } finally {
        deferred.resolve({ nextPageUrl: "/org/projects", token: "reset-token" });
        let chunk = await reader.read();
        while (!chunk.done) {
          remainder += new TextDecoder().decode(chunk.value);
          chunk = await reader.read();
        }
        reader.releaseLock();
      }

      expect(remainder).toContain(`data-form="${name}"`);
    },
    2000,
  );
});

describe("reset-password page", () => {
  it("passes the token unchanged to the form", async () => {
    const html = await renderContent(
      ResetPasswordPage({
        params: Promise.resolve({ locale: "de" }),
        searchParams: Promise.resolve({ token: "signed+token/with=padding" }),
      }),
    );
    expect(html.querySelector('[data-form="reset"]')?.textContent).toBe(
      "signed+token/with=padding",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([undefined, "", [], ["valid"], ["first", "second"]])(
    "redirects invalid token %j using the route locale",
    async (token) => {
      const page = ResetPasswordPage({
        params: Promise.resolve({ locale: "it" }),
        searchParams: Promise.resolve({ token }),
      });
      const errors: unknown[] = [];
      const stream = await renderToReadableStream(page, {
        onError: (error) => {
          errors.push(error);
        },
      });
      await stream.allReady;
      const html = await new Response(stream).text();
      expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith({
        href: LOGIN_PATH,
        locale: "it",
      });
      expect(errors).toEqual([new Error("redirect")]);
      expect(html).not.toContain('data-form="reset"');
    },
  );
});

describe("static auth pages", () => {
  it("passes the route locale to the forgot-password shell", async () => {
    const html = await renderContent(
      ForgotPasswordPage({ params: Promise.resolve({ locale: "nl" }) }),
    );
    expect(html.querySelector("section")?.lang).toBe("nl");
    expect(html.textContent).toContain("forgot password");
  });

  it("uses explicit locale for the verify-email translation and back link", async () => {
    const html = await renderContent(
      VerifyEmailPage({ params: Promise.resolve({ locale: "es" }) }),
    );
    expect(mocks.setRequestLocale).toHaveBeenCalledWith("es");
    expect(mocks.getTranslations).toHaveBeenCalledExactlyOnceWith({
      locale: "es",
      namespace: "authentication.common",
    });
    expect(html.querySelector("section")?.lang).toBe("es");
    expect(html.querySelector("a")?.getAttribute("href")).toBe(LOGIN_PATH);
    expect(html.querySelector("a")?.textContent).toBe("translated:backToLogin");
    expect(html.textContent).toContain("verify email");
  });
});
