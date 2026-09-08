import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Cost Tracker browser oRPC client", () => {
  beforeEach(() => {
    delete globalThis.$costTrackerClient;
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the internal RPC endpoint when no direct server client exists", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetch);

    const { orpc } = await import("@/lib/orpc/orpc");

    await expect(orpc.projects.list()).rejects.toThrow("network unavailable");

    const [request] = fetch.mock.calls[0] ?? [];
    expect(request).toBeInstanceOf(Request);
    expect(new URL(request.url).pathname).toBe("/api/rpc/projects/list");
  });
});
