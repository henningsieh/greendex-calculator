import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Browser oRPC transport", () => {
  beforeEach(() => {
    delete globalThis.$client;
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the current origin and internal RPC path with the v2 fetch arguments", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetch);
    const { orpc } = await import("@/lib/orpc/orpc");
    await expect(orpc.health()).rejects.toThrow("network unavailable");
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(new URL(url).origin).toBe(window.location.origin);
    expect(new URL(url).pathname).toBe("/api/rpc/health");
    expect(init.method).toBe("POST");
  });
});
