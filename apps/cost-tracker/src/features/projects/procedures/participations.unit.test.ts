// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  scope: vi.fn(),
  limit: vi.fn(),
  returning: vi.fn(),
  reviewInsert: vi.fn(),
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
    requireHostCoordination: mocks.scope,
  };
});
vi.mock("@greendex/database", () => {
  const query = {
    from: () => query,
    where: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    for: () => query,
    limit: mocks.limit,
  };
  const executor = {
    select: () => query,
    insert: () => ({
      values: () => ({
        returning: mocks.returning,
        onConflictDoNothing: mocks.reviewInsert,
      }),
    }),
  };
  return {
    db: {
      ...executor,
      transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(executor),
    },
  };
});
import { createParticipationProcedures } from "@/features/projects/procedures/participations";

const client = createRouterClient(
  createParticipationProcedures(() => ({ id: "fixture", contentHash: "hash" })),
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
  mocks.limit
    .mockResolvedValueOnce([{ id: "own" }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: "candidate", email: "fixture@example.org", name: "Candidate" },
    ])
    .mockResolvedValueOnce([]);
});
describe("Participation constraint recovery", () => {
  it("does not describe a representation invariant as authorization denial", async () => {
    mocks.returning.mockRejectedValue({
      cause: { code: "23514", message: "private SQL" },
    });
    await expect(
      client.create({ partnershipId: "own", userId: "candidate" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Participation cannot be created for this Project Partnership.",
      data: { reason: "PARTICIPATION_REPRESENTATION_CONFLICT" },
    });
    expect(mocks.reviewInsert).not.toHaveBeenCalled();
  });
  it("does not claim a duplicate when23505 recovery finds no scoped duplicate", async () => {
    mocks.returning.mockRejectedValue({ code: "23505" });
    mocks.limit
      .mockResolvedValueOnce([{ email: "fixture@example.org" }])
      .mockResolvedValueOnce([]);
    await expect(
      client.create({ partnershipId: "own", userId: "candidate" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      data: { reason: "INTERNAL_FAILURE" },
    });
    expect(mocks.reviewInsert).not.toHaveBeenCalled();
  });
  it("retains the duplicate signal only after recovery proves the scoped duplicate", async () => {
    mocks.returning.mockRejectedValue({ code: "23505" });
    mocks.limit
      .mockResolvedValueOnce([{ email: "fixture@example.org" }])
      .mockResolvedValueOnce([{ id: "existing" }]);
    await expect(
      client.create({ partnershipId: "own", userId: "candidate" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      data: { reason: "PARTICIPATION_DUPLICATE" },
    });
    expect(mocks.reviewInsert).toHaveBeenCalledTimes(1);
  });
});
