// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      createOrganization: mocks.createOrganization,
      getSession: mocks.getSession,
      hasPermission: vi.fn(),
      signInEmail: mocks.signInEmail,
      signInSocial: mocks.signInSocial,
      signOut: mocks.signOut,
      signUpEmail: mocks.signUpEmail,
      updateUser: mocks.updateUser,
    },
  },
}));

import { createRouterClient } from "@orpc/server";
import { APIError } from "better-auth/api";

import { router } from "@/lib/orpc/router";

const requestHeaders = new Headers({ cookie: "session=request-cookie" });

function response(status = 200, body: unknown = { success: true }) {
  return Response.json(body, {
    headers: { "set-cookie": "session=updated; Path=/; HttpOnly" },
    status,
  });
}

function createClient(resHeaders = new Headers()) {
  return createRouterClient(router, {
    context: async () => ({ headers: requestHeaders, resHeaders }),
  });
}

describe("Cost Tracker authentication procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      session: { activeOrganizationId: "organization-id", id: "session-id" },
      user: { id: "user-id" },
    });
    mocks.signInEmail.mockResolvedValue(response());
    mocks.signUpEmail.mockResolvedValue(response());
    mocks.signInSocial.mockResolvedValue(
      response(200, {
        redirect: true,
        url: "https://accounts.google.com/o/oauth2/auth",
      }),
    );
    mocks.signOut.mockResolvedValue(response());
    mocks.createOrganization.mockResolvedValue(response());
    mocks.updateUser.mockResolvedValue(response());
  });

  afterEach(() => vi.restoreAllMocks());

  it("uses request-specific headers and forwards sign-in cookies through the oRPC response seam", async () => {
    const resHeaders = new Headers();

    await expect(
      createClient(resHeaders).authentication.signIn({
        email: "user@example.org",
        password: "correct-horse-battery-staple",
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.signInEmail).toHaveBeenCalledWith({
      asResponse: true,
      body: {
        email: "user@example.org",
        password: "correct-horse-battery-staple",
      },
      headers: requestHeaders,
    });
    expect(resHeaders.getSetCookie()).toEqual([
      "session=updated; Path=/; HttpOnly",
    ]);
  });

  it.each([400, 401, 403, 429] as const)(
    "preserves a Better Auth HTTP %i failure as a distinct typed oRPC error",
    async (status) => {
      mocks.signInEmail.mockResolvedValue(response(status));

      await expect(
        createClient().authentication.signIn({
          email: "user@example.org",
          password: "correct-horse-battery-staple",
        }),
      ).rejects.toMatchObject({ status });
    },
  );

  it("preserves failure cookies and distinguishes invalid credentials", async () => {
    const headers = new Headers();
    mocks.signInEmail.mockResolvedValue(
      response(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "private" }),
    );
    await expect(
      createClient(headers).authentication.signIn({
        email: "user@example.org",
        password: "correct-horse-battery-staple",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
      message: "Incorrect email or password.",
      data: { reason: "INVALID_CREDENTIALS" },
    });
    expect(headers.getSetCookie()).toEqual(["session=updated; Path=/; HttpOnly"]);
  });
  it("normalizes thrown APIErrors and residual unknown failures at the shared base", async () => {
    mocks.getSession.mockRejectedValue(
      new APIError("UNAUTHORIZED", {
        code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
      }),
    );
    await expect(
      createClient().authentication.updateUser({ name: "Updated" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
    mocks.signInEmail.mockRejectedValue(new Error("private internal detail"));
    await expect(
      createClient().authentication.signIn({
        email: "user@example.org",
        password: "correct-horse-battery-staple",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
  });

  it("returns only the validated Google redirect URL", async () => {
    await expect(
      createClient().authentication.startGoogleSignIn(),
    ).resolves.toEqual({ url: "https://accounts.google.com/o/oauth2/auth" });
  });
});
