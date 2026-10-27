// @vitest-environment node

import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from "@greendex/config/languages";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { routing } from "@/lib/i18n/routing";
import { config, proxy } from "@/proxy";

function request(path: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(path, "http://localhost:3001"), { headers });
}

describe("Cost Tracker locale proxy", () => {
  it("uses Calculator's prefix and shared language configuration", () => {
    expect(routing.locales).toEqual(LANGUAGE_CODES);
    expect(routing.defaultLocale).toBe(DEFAULT_LANGUAGE);
    expect(routing.localePrefix).toBe("always");
  });

  it.each([
    "/",
    "/login",
    "/register",
    "/projects?scope=hosted",
    "/setup-links/token",
    "/participant-invitations/token",
  ])("internally rewrites legacy %s without changing the browser URL", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
    const destination = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(destination.pathname).toBe(
      `/${DEFAULT_LANGUAGE}${path.split("?")[0] === "/" ? "" : path.split("?")[0]}`,
    );
    expect(destination.search).toBe(
      new URL(path, "http://localhost:3001").search,
    );
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe(
      DEFAULT_LANGUAGE,
    );
  });

  it.each(LANGUAGE_CODES)("accepts explicit %s paths", (locale) => {
    const response = proxy(request(`/${locale}/projects?scope=partner`));
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe(
      locale,
    );
  });

  it("retains next-intl language negotiation and locale cookie precedence", () => {
    const detected = proxy(request("/projects", { "accept-language": "de" }));
    expect(new URL(detected.headers.get("x-middleware-rewrite")!).pathname).toBe(
      "/de/projects",
    );
    const cookie = proxy(
      request("/login", { cookie: "NEXT_LOCALE=fr", "accept-language": "de" }),
    );
    expect(new URL(cookie.headers.get("x-middleware-rewrite")!).pathname).toBe(
      "/fr/login",
    );
  });

  it.each([
    "/accept-invitation",
    "/accept-invitation/bad.token",
    "/accept-invitation/bad.token/extra.segment",
  ])("handles malformed invitation path %s through the locale proxy", (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
    const response = proxy(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe(
      "en",
    );
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe(
      `/en${path}`,
    );
  });

  it.each(LANGUAGE_CODES)(
    "routes undotted %s invitation paths through the proxy",
    (locale) => {
      const url = `/${locale}/accept-invitation/badtoken`;
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
      const response = proxy(request(url));
      expect(response.status).toBe(200);
      expect(response.headers.has("location")).toBe(false);
      expect(
        response.headers.get("x-middleware-request-x-next-intl-locale"),
      ).toBe(locale);
    },
  );

  it.each([
    ...LANGUAGE_CODES.map((locale) => `/${locale}/accept-invitation/bad.token`),
    ...LANGUAGE_CODES.map(
      (locale) => `/${locale}/accept-invitation/bad.token/extra.segment`,
    ),
  ])("leaves dotted localized invitation %s to its locale layout", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it.each([
    "/api/auth/get-session",
    "/api/rpc/projects",
    "/_next/static/chunk.js",
    "/favicon.ico",
    "/projects/report.csv",
    "/en/projects/report.csv",
    "/accept-invitation.png",
    "/en/accept-invitation.png",
    "/api/accept-invitation/bad.token",
    "/_next/accept-invitation/bad.token",
  ])("excludes %s from the proxy", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});
