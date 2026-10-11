import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node
import { getErrorStatus } from "@/lib/orpc/error-status";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  scope: vi.fn(),
  lock: vi.fn(),
  write: vi.fn(),
  limit: vi.fn(),
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
vi.mock("@/features/projects/procedures/claim-locks", () => ({
  lockClaimScope: mocks.lock,
}));
vi.mock("@greendex/database", () => ({
  db: {
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        update: mocks.write,
        insert: mocks.write,
        select: () => ({
          from: () => ({
            where: () => ({ orderBy: () => ({ limit: mocks.limit }) }),
          }),
        }),
      }),
  },
}));

import { markPaid, correctPayment } from "@/features/projects/procedures/payment";

const client = createRouterClient(
  { markPaid, correctPayment },
  { context: async () => ({ headers: new Headers() }) },
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    user: { id: "actor" },
    session: { activeOrganizationId: "host" },
  });
  mocks.scope.mockResolvedValue({
    hostId: "host",
    partnerId: "partner",
    projectId: "project",
  });
  mocks.limit.mockResolvedValue([]);
});

describe("payment predicate outcomes", () => {
  it.each([
    [undefined, "NOT_FOUND", 404, "CLAIM_NOT_FOUND"],
    [
      { id: "claim", status: "submitted", approvedAmountEur: "10.00" },
      "BAD_REQUEST",
      400,
      "CLAIM_APPROVAL_REQUIRED",
    ],
    [
      { id: "claim", status: "approved", approvedAmountEur: null },
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
    [
      { id: "claim", status: "paid", approvedAmountEur: null },
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
    [
      { id: "claim", status: "approved", approvedAmountEur: "20.00" },
      "BAD_REQUEST",
      400,
      "FULL_TRANSFER_REQUIRED",
    ],
  ] as const)(
    "markPaid separates absence, state, invariant and amount (%s)",
    async (claim, code, status, reason) => {
      expect(getErrorStatus(code)).toBe(status);
      mocks.lock.mockResolvedValue({ claim });
      await expect(
        client.markPaid({ partnershipId: "own", amountEur: "10.00" }),
      ).rejects.toMatchObject({ code, data: { reason } });
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it.each([
    [undefined, "NOT_FOUND", 404, "CLAIM_NOT_FOUND"],
    [
      { id: "claim", status: "submitted", approvedAmountEur: "10.00" },
      "BAD_REQUEST",
      400,
      "CLAIM_PAID_REQUIRED",
    ],
    [
      { id: "claim", status: "paid", approvedAmountEur: null },
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
  ] as const)(
    "correctPayment separates absence, state and invariant (%s)",
    async (claim, code, status, reason) => {
      expect(getErrorStatus(code)).toBe(status);
      mocks.lock.mockResolvedValue({ claim });
      await expect(
        client.correctPayment({ partnershipId: "own", reason: "Correction" }),
      ).rejects.toMatchObject({ code, data: { reason } });
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it("keeps exact paid retries idempotent", async () => {
    mocks.lock.mockResolvedValue({
      claim: { id: "claim", status: "paid", approvedAmountEur: "10.00" },
    });
    expect(
      await client.markPaid({ partnershipId: "own", amountEur: "10.00" }),
    ).toEqual({ id: "claim", status: "paid", approvedAmountEur: "10.00" });
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
