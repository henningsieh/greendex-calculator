// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/better-auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

afterEach(() => vi.restoreAllMocks());
describe("Calculator direct SSR client", () => {
  it("avoids network transport and resolves headers for every request", async () => {
    vi.resetModules();
    delete globalThis.$client;
    await import("@/lib/orpc/client.server");
    const first = new Headers({ cookie: "session=first" });
    const second = new Headers({ cookie: "session=second" });
    mocks.headers.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const fetch = vi.spyOn(globalThis, "fetch");
    // Router utilities import the universal client during router evaluation.
    // Re-evaluate it after the direct client has been attached, as in the REST SSR guard.
    vi.resetModules();
    const { orpc } = await import("@/lib/orpc/orpc");
    await expect(orpc.betterauth.getSession()).resolves.toBeNull();
    await expect(orpc.betterauth.getSession()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.headers).toHaveBeenCalledTimes(2);
    expect(mocks.getSession).toHaveBeenNthCalledWith(1, { headers: first });
    expect(mocks.getSession).toHaveBeenNthCalledWith(2, { headers: second });
  });
});

afterAll(() => {
  vi.doUnmock("server-only");
  vi.doUnmock("next/headers");
  vi.doUnmock("@/lib/better-auth");
  vi.resetModules();
  delete globalThis.$client;
});
