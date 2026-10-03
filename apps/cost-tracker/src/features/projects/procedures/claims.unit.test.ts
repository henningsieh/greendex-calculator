// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  scope: vi.fn(),
  limit: vi.fn(),
  returning: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/features/projects/procedures/coordination", async () => {
  const { z } = await import("zod");
  return {
    coordinationId: z.string().min(1),
    requirePartnerCoordination: mocks.scope,
  };
});
vi.mock("@greendex/database", () => ({
  db: {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const query = {
        from: () => query,
        where: () => query,
        innerJoin: () => query,
        for: () => query,
        limit: mocks.limit,
      };
      return callback({
        select: () => query,
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({ returning: mocks.returning }),
          }),
        }),
      });
    },
  },
}));
import { saveDraft } from "@/features/projects/procedures/claims";

const client = createRouterClient(
  { saveDraft },
  { context: async () => ({ headers: new Headers() }) },
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "partner" },
  });
  mocks.scope.mockResolvedValue({
    hostId: "host",
    partnerId: "partner",
    projectId: "project",
  });
  mocks.returning.mockResolvedValue([]);
  mocks.limit
    .mockResolvedValueOnce([{ id: "own" }])
    .mockResolvedValueOnce([{ id: "account" }])
    .mockResolvedValueOnce([]);
});
describe("Claim first-save conflict recovery", () => {
  it("does not call an absent reread Claim non-editable", async () => {
    mocks.limit.mockResolvedValueOnce([]);
    await expect(
      client.saveDraft({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
  });
  it("retains400 for a proven locked reread Claim", async () => {
    mocks.limit.mockResolvedValueOnce([
      {
        id: "claim",
        partnershipId: "own",
        status: "submitted",
        approvedAmountEur: null,
      },
    ]);
    await expect(
      client.saveDraft({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "CLAIM_NOT_EDITABLE" },
    });
  });
  it("preserves the raced editable Claim retry", async () => {
    const claim = {
      id: "claim",
      partnershipId: "own",
      status: "editable",
      approvedAmountEur: null,
    };
    mocks.limit.mockResolvedValueOnce([claim]);
    expect(await client.saveDraft({ partnershipId: "own" })).toEqual({
      id: "claim",
      partnershipId: "own",
      status: "editable",
    });
  });
});
