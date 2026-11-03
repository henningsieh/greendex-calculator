import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/database", () => ({ db: {} }));

import { createServerAuth, trustedOriginsFor } from "./server-auth";

function authFor(baseURL: string) {
  return createServerAuth({
    appName: "Auth options pinning test",
    baseURL,
    secret: "local-unit-test-secret-with-at-least-32-characters",
    socialProviders: {
      google: { clientId: "test-client", clientSecret: "test-secret" },
    },
    emailSender: {
      sendEmailVerificationEmail: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
    },
  });
}

function organizationPluginOptions(auth: ReturnType<typeof authFor>) {
  const plugin = auth.options.plugins?.find(
    (candidate) => candidate.id === "organization",
  ) as
    | { options?: { requireEmailVerificationOnInvitation?: unknown } }
    | undefined;
  return plugin?.options;
}

describe("trustedOriginsFor", () => {
  it("keeps loopback origins closed without a www alias", () => {
    expect(trustedOriginsFor("http://localhost:3000")).toEqual([
      "http://localhost:3000",
    ]);
    expect(trustedOriginsFor("http://127.0.0.1:3002")).toEqual([
      "http://127.0.0.1:3002",
    ]);
  });

  it("trusts the deployment origin plus its www alias", () => {
    expect(trustedOriginsFor("https://greendex.apps.sieh.org")).toEqual([
      "https://greendex.apps.sieh.org",
      "https://www.greendex.apps.sieh.org",
    ]);
    expect(trustedOriginsFor("https://pr-42.greendex.apps.sieh.org")).toEqual([
      "https://pr-42.greendex.apps.sieh.org",
      "https://www.pr-42.greendex.apps.sieh.org",
    ]);
  });

  it("falls back to the raw value for an invalid base URL", () => {
    expect(trustedOriginsFor("not a url")).toEqual(["not a url"]);
  });
});

describe("explicit auth defaults (#373)", () => {
  it("pins the closed origin allowlist derived from the base URL", () => {
    expect(
      authFor("https://greendex.apps.sieh.org").options.trustedOrigins,
    ).toEqual([
      "https://greendex.apps.sieh.org",
      "https://www.greendex.apps.sieh.org",
    ]);
    expect(authFor("http://localhost:3000").options.trustedOrigins).toEqual([
      "http://localhost:3000",
    ]);
  });

  it("pins the explicit account-linking policy instead of silent library defaults", () => {
    expect(
      authFor("https://greendex.apps.sieh.org").options.account?.accountLinking,
    ).toEqual({
      enabled: true,
      trustedProviders: [],
      requireLocalEmailVerified: true,
      allowDifferentEmails: false,
    });
  });

  it("pins the password-reset token lifetime instead of the silent default", () => {
    expect(
      authFor("https://greendex.apps.sieh.org").options.emailAndPassword
        ?.resetPasswordTokenExpiresIn,
    ).toBe(3600);
  });

  it("requires a verified mailbox for organization invitations by default", () => {
    expect(
      organizationPluginOptions(authFor("https://greendex.apps.sieh.org"))
        ?.requireEmailVerificationOnInvitation,
    ).toBe(true);
  });

  it("keeps activeProjectId as the only app-declared session field", () => {
    // activeOrganizationId is owned by the organization plugin schema, not
    // duplicated here — declaring it twice would split tenant-key ownership.
    expect(
      Object.keys(
        authFor("https://greendex.apps.sieh.org").options.session
          ?.additionalFields ?? {},
      ).sort(),
    ).toEqual(["activeProjectId"]);
  });
});
