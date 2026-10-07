// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directCall: vi.fn().mockResolvedValue({ status: "healthy" }),
  install: vi.fn(),
}));
vi.mock("@orpc/client", () => ({
  createORPCClient: () => {
    throw new Error("Browser transport must not be constructed for SSR");
  },
}));
vi.mock("@/components/json-ld", async () => {
  const { orpc } = await import("@/lib/orpc/orpc");
  await orpc.health();
  return { JsonLd: () => null };
});
afterEach(() => {
  vi.clearAllMocks();
  vi.doUnmock("@/lib/orpc/client.server");
  vi.resetModules();
  vi.unstubAllEnvs();
  delete globalThis.$client;
});
function install() {
  vi.resetModules();
  delete globalThis.$client;
  vi.doMock("@/lib/orpc/client.server", () => {
    mocks.install();
    globalThis.$client = { health: mocks.directCall } as never;
    return {};
  });
}
describe("Calculator SSR initialization", () => {
  it("installs the direct client through instrumentation before the universal client", async () => {
    install();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const { register } = await import("@/instrumentation");
    await register();
    const { orpc } = await import("@/lib/orpc/orpc");
    await expect(orpc.health()).resolves.toEqual({ status: "healthy" });
    expect(mocks.install).toHaveBeenCalledOnce();
    expect(mocks.directCall).toHaveBeenCalledOnce();
  });
  it("evaluates the root-layout init before a local SSR consumer", async () => {
    install();
    await import("@/app/layout");
    expect(mocks.install).toHaveBeenCalledOnce();
    expect(mocks.directCall).toHaveBeenCalledOnce();
  });
});

afterAll(() => {
  vi.doUnmock("@orpc/client");
  vi.doUnmock("@/components/json-ld");
  vi.resetModules();
});
