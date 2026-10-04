// @vitest-environment node
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  scope: vi.fn(),
  /** Rows a table returns per read; the last entry repeats. */
  queues: new Map<string, unknown[][]>(),
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
vi.mock("@greendex/database", async () => {
  const schema = await import("@greendex/database/schema");
  const tableNames = new Map<unknown, string>([
    [schema.projectPartnerOrganizationsTable, "partnerships"],
    [schema.partnershipPayoutAccountsTable, "selections"],
    [schema.claimsTable, "claims"],
  ]);
  /** The next queued read for one table, repeating its final entry. */
  const nextRows = (name: string) => {
    const queue = mocks.queues.get(name) ?? [];
    const [first, ...rest] = queue;
    if (rest.length > 0) queue.shift();
    return first ?? [];
  };
  const chain = (name: string) => {
    const pass = () => chain(name);
    return {
      from: pass,
      where: pass,
      innerJoin: pass,
      for: pass,
      limit: async () => nextRows(name),
    };
  };
  return {
    db: {
      transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          select: () => ({
            from: (table: unknown) => chain(tableNames.get(table) ?? ""),
          }),
          insert: () => ({
            values: () => ({
              onConflictDoNothing: () => ({ returning: mocks.returning }),
            }),
          }),
        }),
    },
  };
});
import { saveDraft } from "@/features/projects/procedures/claims";

const client = createRouterClient(
  { saveDraft },
  { context: async () => ({ headers: new Headers() }) },
);
const claim = (status: string) => ({
  id: "claim",
  partnershipId: "own",
  status,
  approvedAmountEur: null,
});
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
  mocks.queues.set("partnerships", [[{ id: "own" }]]);
  mocks.queues.set("selections", [[{ id: "account" }]]);
  mocks.queues.set("claims", [[]]);
});
describe("Claim first-save conflict recovery", () => {
  it("does not call an absent reread Claim non-editable", async () => {
    mocks.queues.set("claims", [[]]);
    await expect(
      client.saveDraft({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
      data: { reason: "INTERNAL_FAILURE" },
    });
  });
  it("retains 400 for a proven locked reread Claim", async () => {
    mocks.queues.set("claims", [[], [claim("submitted")]]);
    await expect(
      client.saveDraft({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "CLAIM_NOT_EDITABLE" },
    });
  });
  it("preserves the raced editable Claim retry", async () => {
    mocks.queues.set("claims", [[], [claim("editable")]]);
    expect(await client.saveDraft({ partnershipId: "own" })).toEqual({
      id: "claim",
      partnershipId: "own",
      status: "editable",
    });
  });
  it("refuses a Claim already locked when the lock is taken", async () => {
    mocks.queues.set("claims", [[claim("correction_requested")]]);
    expect(await client.saveDraft({ partnershipId: "own" })).toEqual({
      id: "claim",
      partnershipId: "own",
      status: "correction_requested",
    });
    mocks.queues.set("claims", [[claim("paid")]]);
    await expect(
      client.saveDraft({ partnershipId: "own" }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      data: { reason: "CLAIM_NOT_EDITABLE" },
    });
  });
});
