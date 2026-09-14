import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
      hasPermission: vi.fn(),
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

  it("forwards auth Set-Cookie headers through the real RPC route without exposing Better Auth output", async () => {
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
  });
});
