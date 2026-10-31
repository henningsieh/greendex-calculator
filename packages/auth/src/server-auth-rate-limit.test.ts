import { describe, expect, it, vi } from "vitest";

vi.mock("@greendex/database", () => ({ db: {} }));

import { z } from "zod";

import { localE2EAuthEnabled, localE2EAuthEnvironment } from "./local-e2e-auth";
import { createServerAuth } from "./server-auth";

function authFor(baseURL: string, localE2EAuth?: boolean) {
  return createServerAuth({
    appName: "Auth rate-limit test",
    baseURL,
    localE2EAuth,
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

describe("local E2E login limit", () => {
  it.each([undefined, false])(
    "keeps Better Auth defaults without opt-in (%s)",
    (enabled) => {
      expect(
        authFor("https://public.example", enabled).options.rateLimit,
      ).toBeUndefined();
      expect(
        authFor("http://127.0.0.1:3002", enabled).options.rateLimit,
      ).toBeUndefined();
    },
  );

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3002",
    "http://[::1]:3002",
  ])("raises only the login limit for explicit local target %s", (baseURL) => {
    expect(authFor(baseURL, true).options.rateLimit).toEqual({
      enabled: true,
      customRules: { "/sign-in/email": { window: 10, max: 30 } },
    });
  });

  it.each([
    "https://public.example",
    "http://localhost.public.example",
    "http://127.0.0.1.public.example",
    "http://localhost@public.example",
    "http://0.0.0.0:3002",
    "http://192.168.1.20:3002",
    "ftp://localhost",
    "file:///tmp/auth",
  ])("refuses opt-in for non-loopback HTTP target %s", (baseURL) => {
    expect(() => authFor(baseURL, true)).toThrow();
  });

  it("keeps rate limiting active and leaves signup at its default limit", async () => {
    const baseURL = "http://127.0.0.1:3002";
    const auth = authFor(
      baseURL,
      localE2EAuthEnabled(
        z
          .object(localE2EAuthEnvironment)
          .parse({ GREENDEX_LOCAL_TEST_SERVER: "1" }),
      ),
    );
    const postInvalid = (path: string) =>
      auth.handler(
        new Request(`${baseURL}/api/auth/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: baseURL },
          body: "{}",
        }),
      );

    for (let request = 0; request < 30; request++) {
      expect((await postInvalid("sign-in/email")).status).toBe(400);
    }
    expect((await postInvalid("sign-in/email")).status).toBe(429);
    for (let request = 0; request < 3; request++) {
      expect((await postInvalid("sign-up/email")).status).toBe(400);
    }
    expect((await postInvalid("sign-up/email")).status).toBe(429);
  });
});
