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

import {
  approve,
  reopen,
  requestCorrection,
} from "@/features/projects/procedures/review";

const client = createRouterClient(
  { approve, reopen, requestCorrection },
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

describe("review predicate outcomes", () => {
  it.each([
    [undefined, "NOT_FOUND", 404, "CLAIM_NOT_FOUND"],
    [
      { id: "claim", status: "editable", approvedAmountEur: null },
      "BAD_REQUEST",
      400,
      "CLAIM_SUBMITTED_REQUIRED",
    ],
    [
      { id: "claim", status: "submitted", approvedAmountEur: null },
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
    [
      { id: "claim", status: "approved", approvedAmountEur: null },
      "INTERNAL_SERVER_ERROR",
      500,
      "INTERNAL_FAILURE",
    ],
  ] as const)(
    "approve separates absence, state and amount invariant (%s)",
    async (claim, code, status, reason) => {
      expect(getErrorStatus(code)).toBe(status);
      mocks.lock.mockResolvedValue({ claim });
      await expect(
        client.approve({ partnershipId: "own" }),
      ).rejects.toMatchObject({ code, data: { reason } });
      expect(mocks.write).not.toHaveBeenCalled();
    },
  );
  it("names the rejected prerequisite for reopen", async () => {
    mocks.lock.mockResolvedValue({
      claim: { id: "claim", status: "editable", approvedAmountEur: null },
    });
    await expect(client.reopen({ partnershipId: "own" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "CLAIM_REJECTED_REQUIRED" },
    });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("preserves reason input validation before mutation", async () => {
    await expect(
      client.requestCorrection({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "REVIEW_REASON_REQUIRED" },
    });
    expect(mocks.lock).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });
});
