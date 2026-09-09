// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  hasPermission: vi.fn(),
  headers: vi.fn(),
  orderBy: vi.fn().mockResolvedValue([]),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: mocks.getSession, hasPermission: mocks.hasPermission },
  },
}));
vi.mock("@greendex/database", () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: () => chain,
        orderBy: mocks.orderBy,
      };
      return chain;
    },
  },
}));

import "@/lib/orpc/client.server";
import { orpc } from "@/lib/orpc/orpc";

const firstRequestHeaders = new Headers({ cookie: "session=first" });
const secondRequestHeaders = new Headers({ cookie: "session=second" });

describe("Cost Tracker server oRPC client", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderBy.mockResolvedValue([]);
    mocks.getSession.mockResolvedValue({
      session: {
        id: "session-id",
        userId: "user-id",
        activeOrganizationId: "organization-id",
      },
      user: {
        id: "user-id",
        name: "Cost Tracker User",
        email: "user@example.com",
      },
    });
    mocks.hasPermission.mockResolvedValue({ success: true });
  });

  it("uses the direct router client without making an RPC request", async () => {
    mocks.headers.mockResolvedValue(firstRequestHeaders);
    const fetch = vi.spyOn(globalThis, "fetch");

    await expect(orpc.projectPartnerships.list()).resolves.toEqual([]);

    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.getSession).toHaveBeenCalledWith({
      headers: firstRequestHeaders,
    });
  });

  it("resolves request headers for each direct procedure call", async () => {
    mocks.headers
      .mockResolvedValueOnce(firstRequestHeaders)
      .mockResolvedValueOnce(secondRequestHeaders);

    await orpc.projectPartnerships.list();
    await orpc.projectPartnerships.list();

    expect(mocks.headers).toHaveBeenCalledTimes(2);
    expect(mocks.getSession).toHaveBeenNthCalledWith(1, {
      headers: firstRequestHeaders,
    });
    expect(mocks.getSession).toHaveBeenNthCalledWith(2, {
      headers: secondRequestHeaders,
    });
  });
});
