// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPublicInvitationEntry: vi.fn(),
  createOrganization: vi.fn(),
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/authentication/onboarding-context", () => ({
  loadPublicInvitationEntry: mocks.loadPublicInvitationEntry,
  loadOnboardingFacts: vi.fn(),
}));

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
    mocks.loadPublicInvitationEntry.mockResolvedValue({
      kind: "organization-invitation",
      status: "pending",
      invitationId: "invite_123",
      organization: { id: "org-1", name: "Example Organization" },
    });
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
    mocks.createOrganization.mockResolvedValue(
      response(200, { id: "created-org" }),
    );
    mocks.updateUser.mockResolvedValue(response());
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    [undefined, "/projects"],
    ["/accept-invitation/invite_123", "/accept-invitation/invite_123"],
    [
      "/setup-links/setup_123?secret=abc_DEF-123",
      "/setup-links/setup_123?secret=abc_DEF-123",
    ],
    ["https://example.org", "/projects"],
    ["//example.org", "/projects"],
    ["/projects?next=https://example.org", "/projects"],
  ])(
    "uses a safe verification callback for signup returnTo %s",
    async (returnTo, callbackURL) => {
      const input = {
        name: "Alex Morgan",
        email: "user@example.org",
        password: "correct-horse-battery-staple",
      };
      await createClient().authentication.signUp({ ...input, returnTo });
      expect(mocks.signUpEmail).toHaveBeenCalledExactlyOnceWith({
        asResponse: true,
        body: { ...input, callbackURL },
        headers: requestHeaders,
      });
    },
  );

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

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [429, "TOO_MANY_REQUESTS"],
  ] as const)(
    "preserves a Better Auth HTTP %i failure as a distinct typed oRPC error",
    async (status, code) => {
      mocks.signInEmail.mockResolvedValue(response(status));

      await expect(
        createClient().authentication.signIn({
          email: "user@example.org",
          password: "correct-horse-battery-staple",
        }),
      ).rejects.toMatchObject({ code });
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
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
  });

  it.each(["organization-id", null])(
    "returns the exact created ID and preserves an existing acting Organization (%s)",
    async (activeOrganizationId) => {
      mocks.getSession.mockResolvedValue({
        session: { id: "session-id", activeOrganizationId },
        user: { id: "user-id" },
      });
      const resHeaders = new Headers();
      const input = {
        name: "New Organization",
        slug: "new-organization",
        country: "DE" as const,
      };
      await expect(
        createClient(resHeaders).authentication.createOrganization(input),
      ).resolves.toEqual({ success: true, organizationId: "created-org" });
      expect(mocks.createOrganization).toHaveBeenCalledExactlyOnceWith({
        asResponse: true,
        headers: requestHeaders,
        body: {
          ...input,
          keepCurrentActiveOrganization: Boolean(activeOrganizationId),
        },
      });
      expect(resHeaders.getSetCookie()).toEqual([
        "session=updated; Path=/; HttpOnly",
      ]);
    },
  );

  it.each([
    ["ORGANIZATION_ALREADY_EXISTS", "ORGANIZATION_SLUG_TAKEN_BEFORE_CREATION"],
    [
      "ORGANIZATION_NAME_ALREADY_EXISTS",
      "ORGANIZATION_NAME_TAKEN_BEFORE_CREATION",
    ],
  ])(
    "confirms the pre-insertion %s refusal as safe to retry",
    async (code, reason) => {
      mocks.createOrganization.mockResolvedValueOnce(
        response(400, { code, message: "private" }),
      );
      const input = { name: "Taken", slug: "taken", country: "DE" as const };
      const resHeaders = new Headers();
      await expect(
        createClient(resHeaders).authentication.createOrganization(input),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "This Organization name is already in use. Choose another name.",
        data: { reason },
      });
      expect(resHeaders.getSetCookie()).toEqual([
        "session=updated; Path=/; HttpOnly",
      ]);
      await expect(
        createClient().authentication.createOrganization({
          ...input,
          name: "Available",
          slug: "available",
        }),
      ).resolves.toEqual({ success: true, organizationId: "created-org" });
    },
  );

  it.each([
    [
      500,
      { code: "ORGANIZATION_ALREADY_EXISTS" },
      "INTERNAL_SERVER_ERROR",
      "INTERNAL_FAILURE",
    ],
    [
      500,
      { code: "ORGANIZATION_NAME_ALREADY_EXISTS" },
      "INTERNAL_SERVER_ERROR",
      "INTERNAL_FAILURE",
    ],
    [
      400,
      { message: "Choose a different Organization name." },
      "BAD_REQUEST",
      "INVALID_INPUT",
    ],
    [400, { code: "UNKNOWN_CREATION_FAILURE" }, "BAD_REQUEST", "INVALID_INPUT"],
    [
      400,
      { message: "ORGANIZATION_ALREADY_EXISTS" },
      "BAD_REQUEST",
      "INVALID_INPUT",
    ],
  ])(
    "does not confirm no creation from HTTP %s with unrelated metadata",
    async (status, body, code, reason) => {
      mocks.createOrganization.mockResolvedValueOnce(response(status, body));
      await expect(
        createClient().authentication.createOrganization({
          name: "Taken",
          slug: "taken",
          country: "DE",
        }),
      ).rejects.toMatchObject({ code, data: { reason } });
    },
  );

  it("returns only the validated Google redirect URL", async () => {
    await expect(
      createClient().authentication.startGoogleSignIn(),
    ).resolves.toEqual({ url: "https://accounts.google.com/o/oauth2/auth" });
  });
});

it("returns a private server signup receipt without requiring a session", async () => {
  const resHeaders = new Headers();
  mocks.signUpEmail.mockResolvedValue(response());
  expect(
    await createClient(resHeaders).authentication.signUp({
      name: "Alex Morgan",
      email: "submitted@example.org",
      password: "correct-horse-battery-staple",
      returnTo: "/accept-invitation/invite_123",
    }),
  ).toEqual({
    success: true,
    decision: {
      entryContext: "organization-invitation",
      nextStep: "verify-email",
      invitation: {
        invitationId: "invite_123",
        organization: { id: "org-1", name: "Example Organization" },
      },
      email: "submitted@example.org",
      availableActions: [
        {
          kind: "authenticate",
          entry: "login",
          returnTo: "/accept-invitation/invite_123",
        },
      ],
    },
  });
  expect(resHeaders.get("cache-control")).toBe("private, no-store");
  expect(mocks.getSession).not.toHaveBeenCalled();
});

it("keeps malformed signup return data in recovery without authorizing it as callback", async () => {
  mocks.loadPublicInvitationEntry.mockResolvedValue({
    kind: "organization-invitation",
    status: "recovery",
    reason: "STAFF_INVITATION_NOT_FOUND",
  });
  expect(
    await createClient().authentication.signUp({
      name: "Alex Morgan",
      email: "submitted@example.org",
      password: "correct-horse-battery-staple",
      returnTo: "/accept-invitation/bad!",
    }),
  ).toEqual({
    success: true,
    decision: {
      entryContext: "organization-invitation",
      nextStep: "invitation-recovery",
      reason: "STAFF_INVITATION_NOT_FOUND",
      returnTo: "/accept-invitation",
      availableActions: [{ kind: "recheck" }],
    },
  });
  expect(mocks.signUpEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      body: expect.objectContaining({ callbackURL: "/projects" }),
    }),
  );
});
