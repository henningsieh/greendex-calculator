// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directCall: vi.fn().mockResolvedValue({ hosted: true, partner: false }),
  installDirectClient: vi.fn(),
}));

vi.mock("@orpc/client", () => ({
  createORPCClient: () => {
    throw new Error("The browser RPC transport must not be created for SSR.");
  },
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "" }),
  Geist_Mono: () => ({ variable: "" }),
  Inter: () => ({ variable: "" }),
}));
vi.mock("@/components/nuqs-provider", async () => {
  const { orpc } = await import("@/lib/orpc/orpc");
  await orpc.projects.availableScopes();

  return {
    NuqsProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock("@/components/query-provider", () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/toast", () => ({
  Toaster: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/utils", () => ({ cn: () => "" }));

afterEach(() => {
  vi.clearAllMocks();
  vi.doUnmock("@/lib/orpc/client.server");
  vi.resetModules();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, "$costTrackerClient");
});

function mockDirectClientInstallation() {
  vi.doMock("@/lib/orpc/client.server", () => {
    mocks.installDirectClient();
    globalThis.$costTrackerClient = {
      projects: { availableScopes: mocks.directCall },
    } as never;
    return {};
  });
}

describe("Cost Tracker SSR oRPC initialization entrypoints", () => {
  it("installs the direct client from instrumentation before an SSR consumer loads", async () => {
    mockDirectClientInstallation();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    const { register } = await import("@/instrumentation");
    await register();
    const { orpc } = await import("@/lib/orpc/orpc");

    await expect(orpc.projects.availableScopes()).resolves.toEqual({
      hosted: true,
      partner: false,
    });
    // Red if register removes, incorrectly gates, or delays the server-client import.
    expect(mocks.installDirectClient).toHaveBeenCalledOnce();
    // Red if SSR falls back to the browser RPC transport, which throws on construction.
    expect(mocks.directCall).toHaveBeenCalledOnce();
  });

  it("evaluates the root-layout direct-client import before a local SSR consumer", async () => {
    mockDirectClientInstallation();
    await import("@/app/layout");

    // Red if the side-effect import is removed or moves below a local SSR consumer.
    expect(mocks.installDirectClient).toHaveBeenCalledOnce();
    // Red if that consumer constructs browser transport instead of using the direct client.
    expect(mocks.directCall).toHaveBeenCalledOnce();
  });
});
