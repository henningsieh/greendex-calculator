// @vitest-environment node

import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@greendex/database", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({ orderBy: mocks.orderBy }),
        }),
      }),
    }),
  },
}));

import { listMemberships } from "@/features/organizations/procedures/memberships";

const client = createRouterClient(
  { listMemberships },
  { context: async () => ({ headers: new Headers() }) },
);

const rows = [
  { id: "org-b", name: "Beta", role: "participant" },
  { id: "org-a", name: "Alpha", role: "owner" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "user-1" },
    session: { id: "session-1", userId: "user-1", activeOrganizationId: null },
  });
  mocks.orderBy.mockResolvedValue(rows);
});

describe("organizations listMemberships", () => {
  it("lists the caller's Memberships without requiring an active Organization", async () => {
    await expect(client.listMemberships()).resolves.toEqual(rows);
  });

  it("refuses unauthenticated callers", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(client.listMemberships()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
