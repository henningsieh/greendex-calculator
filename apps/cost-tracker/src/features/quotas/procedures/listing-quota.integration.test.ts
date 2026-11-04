// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import {
  member,
  organization,
  principalQuotaCounters as counters,
  user,
} from "@greendex/database/schema";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { and, eq, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ownedCleanup } from "@/features/quotas/procedures/owned-cleanup.test-helper";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  permission: vi.fn(),
  cleanupExecutor: undefined as Pick<typeof db, "execute"> | undefined,
  headers: vi.fn(),
  failRead: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@greendex/database", async (original) => {
  const actual = await original<typeof import("@greendex/database")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, key) {
        if (key === "select")
          return (fields?: unknown) => {
            if (
              mocks.failRead &&
              fields &&
              typeof fields === "object" &&
              "startDate" in fields
            )
              throw new Error("simulated listing query failure");
            return Reflect.apply(target.select.bind(target), target, [fields]);
          };
        if (key === "execute")
          return ownedCleanup(mocks.cleanupExecutor ?? target, [organizationId])
            .execute;
        return Reflect.get(target, key);
      },
    }),
  };
});
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.session, hasPermission: mocks.permission } },
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
import { POST } from "@/app/api/rpc/[[...rest]]/route";
import "@/lib/orpc/client.server";
import { orpc } from "@/lib/orpc/orpc";
import { router } from "@/lib/orpc/router";

const organizationId = `listing-quota-${randomUUID()}`;
const userId = `${organizationId}-user`;
const owned = and(
  eq(counters.organizationId, organizationId),
  eq(counters.userKey, userId),
);
const client = createRouterClient(router, {
  context: { headers: new Headers() },
});
const calls = [
  () => client.projects.listHosted({ pageSize: 25 }),
  () => client.projects.listPartner({ pageSize: 25 }),
  () => client.projects.searchHosted({ search: "" }),
  () => client.projectPartnerships.list(),
];
const usage = async () =>
  (await db.select().from(counters).where(owned))[0]?.used;
async function seed(used: number) {
  const start = new Date(Math.ceil(Date.now() / 60000) * 60000 + 60000);
  await db.insert(counters).values({
    kind: "listing_calls",
    organizationId,
    userKey: userId,
    windowStart: start,
    expiresAt: new Date(start.getTime() + 60000),
    used: BigInt(used),
  });
}
beforeAll(async () => {
  const target = new URL(process.env.DATABASE_URL!);
  if (
    target.hostname !== "188.245.144.137" ||
    target.port !== "5489" ||
    target.pathname !== "/greendex_development"
  )
    throw new Error("Unapproved listing test database");
  await db.insert(user).values({
    id: userId,
    name: "Listing quota",
    email: `${userId}@example.com`,
  });
  await db.insert(organization).values({
    id: organizationId,
    name: "Listing quota",
    slug: organizationId,
    country: "DE",
    createdAt: new Date(),
  });
  await db.insert(member).values({
    id: randomUUID(),
    userId,
    organizationId,
    role: "owner",
    createdAt: new Date(),
  });
});
beforeEach(async () => {
  mocks.session.mockReset().mockResolvedValue({
    user: { id: userId },
    session: { activeOrganizationId: organizationId },
  });
  mocks.failRead = false;
  mocks.permission.mockReset().mockResolvedValue({ success: true });
  mocks.headers.mockResolvedValue(new Headers());
  await db.delete(counters).where(owned);
});
afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(user).where(eq(user.id, userId));
  await db.delete(counters).where(owned);
});

describe("shared listing procedure budget", () => {
  it("restricts automatic cleanup to this file's fixture Organizations", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`create temporary table principal_quota_counters (like public.principal_quota_counters including all) on commit drop`,
      );
      await tx.execute(
        sql`insert into principal_quota_counters values
          ('listing_calls', ${organizationId}, 'expired', '2000-01-01', '2000-01-02', 1),
          ('listing_calls', 'unrelated-fixture', 'expired', '2000-01-01', '2000-01-02', 1)`,
      );
      mocks.cleanupExecutor = tx;
      try {
        await calls[0]();
        expect(await usage()).toBe(1n);
        const remaining = await tx.execute(
          sql`select organization_id from principal_quota_counters`,
        );
        expect(remaining.rows).toEqual([
          { organization_id: "unrelated-fixture" },
        ]);
      } finally {
        mocks.cleanupExecutor = undefined;
      }
    });
  });
  it("admits exactly 120 mixed calls across all four endpoints", async () => {
    await seed(0);
    const results = await Promise.allSettled(
      Array.from({ length: 128 }, (_, i) => calls[i % 4]()),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(120);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(8);
    for (const result of rejected)
      expect(result.reason).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests were sent. Wait a moment and try again.",
        data: { reason: "RATE_LIMITED" },
      });
    expect(await usage()).toBe(120n);
  }, 20000);
  it.each([0, 1, 2, 3])(
    "blocks endpoint %i once the shared budget is spent",
    async (endpoint) => {
      await seed(120);
      await expect(calls[endpoint]()).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        data: { reason: "RATE_LIMITED" },
      });
      expect(await usage()).toBe(120n);
    },
  );
  it("does not charge unauthenticated, missing-Organization, invalid-input or permission refusals", async () => {
    mocks.session.mockResolvedValueOnce(null);
    await expect(calls[0]()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    mocks.session.mockResolvedValueOnce({ user: { id: userId }, session: {} });
    await expect(calls[1]()).rejects.toMatchObject({
      data: { reason: "ACTIVE_ORGANIZATION_REQUIRED" },
    });
    await expect(
      client.projects.searchHosted({ search: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.projects.listHosted({ pageSize: 25, cursor: "not-a-cursor" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    mocks.permission.mockResolvedValue({ success: false });
    await expect(calls[0]()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(calls[1]()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(calls[3]()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await usage()).toBeUndefined();
  });
  it("does not charge missing membership or non-staff roles", async () => {
    mocks.session.mockResolvedValueOnce({
      user: { id: "not-a-member" },
      session: { activeOrganizationId: organizationId },
    });
    await expect(calls[2]()).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "ORGANIZATION_MEMBERSHIP_REQUIRED" },
    });
    await db
      .update(member)
      .set({ role: "participant" })
      .where(
        and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
      );
    try {
      await expect(calls[0]()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(calls[2]()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await usage()).toBeUndefined();
    } finally {
      await db
        .update(member)
        .set({ role: "owner" })
        .where(
          and(
            eq(member.userId, userId),
            eq(member.organizationId, organizationId),
          ),
        );
    }
  });
  it("preserves input and permission error precedence even when exhausted", async () => {
    await seed(120);
    await expect(
      client.projects.listHosted({ pageSize: 25, cursor: "not-a-cursor" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    mocks.permission.mockResolvedValue({ success: false });
    await expect(calls[1]()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await usage()).toBe(120n);
  });
  it("enforces the counter through the actual direct SSR client without fetch", async () => {
    await seed(119);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await expect(orpc.projectPartnerships.list()).resolves.toEqual([]);
      await expect(
        orpc.projects.searchHosted({ search: "" }),
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        data: { reason: "RATE_LIMITED" },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(await usage()).toBe(120n);
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it("retains the admitted charge if a later data read fails", async () => {
    mocks.failRead = true;
    await expect(calls[0]()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(await usage()).toBe(1n);
  });
  it("returns safe RPC HTTP 429 without identifiers or totals", async () => {
    await seed(120);
    let responseStatus = 0;
    let payload: unknown;
    const rpc = createORPCClient<RouterClient<typeof router>>(
      new RPCLink({
        origin: "http://localhost:3002",
        url: "/api/rpc",
        fetch: async (request, init) => {
          const response = await POST(new Request(request, init));
          responseStatus = response.status;
          payload = await response.clone().json();
          return response;
        },
      }),
    );
    await expect(rpc.projects.searchHosted({ search: "" })).rejects.toMatchObject(
      { code: "TOO_MANY_REQUESTS", data: { reason: "RATE_LIMITED" } },
    );
    expect(responseStatus).toBe(429);
    expect(payload).toEqual({
      json: {
        defined: true,
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests were sent. Wait a moment and try again.",
        data: { reason: "RATE_LIMITED" },
      },
    });
    expect(await usage()).toBe(120n);
  });
});
