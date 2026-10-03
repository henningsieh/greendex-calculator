// @vitest-environment node
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      hasPermission: mocks.hasPermission,
      signInEmail: mocks.signInEmail,
    },
  },
}));

describe("Cost Tracker RPC authentication transport", () => {
  beforeEach(() => {
    delete globalThis.$costTrackerClient;
    vi.resetModules();
    mocks.getSession.mockReset();
    mocks.signInEmail.mockReset().mockResolvedValue(
      Response.json(
        { redirect: false, token: "never-expose-this", user: { id: "user-id" } },
        {
          headers: { "set-cookie": "session=updated; Path=/; HttpOnly" },
        },
      ),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it(
    "maps projects/get non-members to 403 instead of 500 on HTTP",
    { timeout: 30_000 },
    async () => {
      mocks.getSession.mockResolvedValue({
        session: { id: "session-id", activeOrganizationId: "organization-id" },
        user: { id: "user-id" },
      });
      mocks.hasPermission.mockRejectedValue(
        new APIError("UNAUTHORIZED", {
          code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
        }),
      );
      const { POST } = await import("@/app/api/rpc/[[...rest]]/route");
      const response = await POST(
        new Request("http://localhost/api/rpc/projects/get", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ json: { projectId: "project-id" } }),
        }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        json: {
          code: "FORBIDDEN",
          message: "Membership in the active Organization is required.",
          data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
        },
      });
    },
  );

  // Imports the real route/router chain after a module reset, which can exceed
  // the default 5s timeout when the full suite saturates the machine.
  it(
    "forwards auth Set-Cookie headers through the real RPC route without exposing Better Auth output",
    { timeout: 30_000 },
    async () => {
      let rpcResponse: Response | undefined;
      const { POST } = await import("@/app/api/rpc/[[...rest]]/route");
      vi.stubGlobal(
        "fetch",
        async (input: RequestInfo | URL, init?: RequestInit) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          rpcResponse = await POST(request);
          return rpcResponse;
        },
      );
      const { env } = await import("@/env");
      vi.stubGlobal("window", {
        location: { origin: new URL(env.NEXT_PUBLIC_BASE_URL).origin },
      });
      const { orpc } = await import("@/lib/orpc/orpc");

      await expect(
        orpc.authentication.signIn({
          email: "user@example.org",
          password: "correct-horse-battery-staple",
        }),
      ).resolves.toEqual({ success: true });

      expect(rpcResponse?.headers.getSetCookie()).toEqual([
        "session=updated; Path=/; HttpOnly",
      ]);
    },
  );
});
