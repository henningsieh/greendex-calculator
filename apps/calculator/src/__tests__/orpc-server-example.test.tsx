import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ORPCServerExample from "@/app/[locale]/(app)/orpc-server-example/page";
import { router } from "@/lib/orpc/router";

const mocks = vi.hoisted(() => ({
  createRouterClient: vi.fn(),
  headers: vi.fn(),
  health: vi.fn(),
  helloWorld: vi.fn(),
}));
vi.mock("@orpc/server", () => ({ createRouterClient: mocks.createRouterClient }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/orpc/router", () => ({ router: { health: {}, helloWorld: {} } }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createRouterClient.mockReturnValue({
    health: mocks.health,
    helloWorld: mocks.helloWorld,
  });
  mocks.health.mockResolvedValue({
    status: "healthy",
    environment: "test",
    uptime: 42.9,
    timestamp: "2026-01-01T12:00:00Z",
  });
  mocks.helloWorld.mockResolvedValue({
    message: "Hello, Server!",
    timestamp: "2026-01-01T12:00:00Z",
  });
});

describe("oRPC server example", () => {
  it("renders the in-process client's live procedure results", async () => {
    const html = renderToStaticMarkup(await ORPCServerExample());
    expect(mocks.createRouterClient).toHaveBeenCalledExactlyOnceWith(router, {
      context: expect.any(Function),
    });
    expect(mocks.health).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.helloWorld).toHaveBeenCalledExactlyOnceWith({ name: "Server" });
    expect(html).toContain("healthy");
    expect(html).toContain("Hello, Server!");
    expect(html).toContain("42s");
  });

  it("constructs a caller per render and resolves headers from the current request", async () => {
    await ORPCServerExample();
    await ORPCServerExample();
    expect(mocks.createRouterClient).toHaveBeenCalledTimes(2);
    expect(mocks.headers).not.toHaveBeenCalled();
    const contexts = mocks.createRouterClient.mock.calls.map(
      ([, options]) => options.context,
    );
    expect(contexts[0]).not.toBe(contexts[1]);
    for (const [index, context] of contexts.entries()) {
      const requestHeaders = new Headers({ "x-request-id": String(index) });
      mocks.headers.mockResolvedValueOnce(requestHeaders);
      expect((await context()).headers).toBe(requestHeaders);
    }
    expect(mocks.headers).toHaveBeenCalledTimes(2);
  });

  it.each(["health", "helloWorld"] as const)(
    "propagates %s failures instead of displaying stale success data",
    async (procedure) => {
      mocks[procedure].mockRejectedValue(new Error("procedure unavailable"));
      await expect(ORPCServerExample()).rejects.toThrow("procedure unavailable");
      if (procedure === "health") expect(mocks.helloWorld).not.toHaveBeenCalled();
    },
  );
});
