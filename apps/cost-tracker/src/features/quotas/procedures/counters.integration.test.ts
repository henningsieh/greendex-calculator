// @vitest-environment node
import { randomUUID } from "node:crypto";

import { db } from "@greendex/database";
import { principalQuotaCounters as counters } from "@greendex/database/schema";
import { eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ownedCleanup } from "@/__tests__/owned-cleanup.test-helper";

const control = vi.hoisted(() => ({
  instant: undefined as string | undefined,
  cleanupExecutor: undefined as Pick<typeof db, "execute"> | undefined,
  failCleanup: false,
  failConsumption: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@greendex/database", async (original) => {
  const actual = await original<typeof import("@greendex/database")>();
  return {
    ...actual,
    db: new Proxy(actual.db, {
      get(target, key) {
        if (key === "transaction")
          return (callback: Parameters<typeof actual.db.transaction>[0]) =>
            target.transaction(async (tx) => {
              if (control.failConsumption)
                await tx.execute(
                  sql`create temporary table principal_quota_counters (like public.principal_quota_counters including all, check (used = 0)) on commit drop`,
                );
              return callback(
                control.instant
                  ? controlledClock(tx, () => control.instant!)
                  : tx,
              );
            });
        if (key === "execute") {
          if (control.failCleanup)
            return () => {
              throw new Error("private connection detail");
            };
          return ownedCleanup(control.cleanupExecutor ?? target, [
            organizationId,
            `${organizationId}-second`,
          ]).execute;
        }
        return Reflect.get(target, key);
      },
    }),
  };
});
import {
  consumeUploadBytes,
  DAILY_UPLOAD_BYTES,
  deleteExpiredQuotaRows,
  enforceListingLimit,
  QUOTA_CLEANUP_BATCH_SIZE,
} from "@/features/quotas/procedures/counters";

const organizationId = `quota-378-${randomUUID()}`;
const principal = { organizationId, userId: "reader" };
const owned = eq(counters.organizationId, organizationId);
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

beforeAll(() => {
  const target = new URL(process.env.DATABASE_URL!);
  if (
    target.hostname !== "188.245.144.137" ||
    target.port !== "5489" ||
    target.pathname !== "/greendex_development"
  )
    throw new Error("Unapproved quota test database");
});
afterEach(async () => {
  vi.restoreAllMocks();
  control.instant = undefined;
  control.failCleanup = false;
  control.failConsumption = false;
  await db.delete(counters).where(owned);
});
async function seed(
  kind: "upload_bytes" | "listing_calls",
  used: number,
  start = new Date(
    Math.ceil(Date.now() / (kind === "upload_bytes" ? 86400000 : 60000)) *
      (kind === "upload_bytes" ? 86400000 : 60000) +
      60000,
  ),
) {
  await db.insert(counters).values({
    kind,
    organizationId,
    userKey: kind === "upload_bytes" ? "" : principal.userId,
    used: BigInt(used),
    windowStart: start,
    expiresAt: new Date(
      start.getTime() + (kind === "upload_bytes" ? 86400000 : 60000),
    ),
  });
}
const upload = (bytes: number) =>
  db.transaction((tx) =>
    consumeUploadBytes(tx, { partnerOrganizationId: organizationId, bytes }),
  );
const rows = () => db.select().from(counters).where(owned);
const listing = () => enforceListingLimit(principal, {});

function controlledClock(tx: Transaction, instant: () => string): Transaction {
  return new Proxy(tx, {
    get(target, key) {
      if (key === "execute")
        return (statement: Parameters<Transaction["execute"]>[0]) => {
          if (typeof statement === "string") return target.execute(statement);
          const query = new PgDialect().sqlToQuery(statement.getSQL());
          if (!query.sql.includes("with sample"))
            return target.execute(statement);
          const chunks = query.sql
            .split(/(\$\d+|clock_timestamp\(\))/g)
            .map((part) => {
              if (part === "clock_timestamp()")
                return sql`${instant()}::timestamptz`;
              if (/^\$\d+$/.test(part))
                return sql`${query.params[Number(part.slice(1)) - 1]}`;
              return sql.raw(part);
            });
          return target.execute(sql.join(chunks, sql.raw("")));
        };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

describe("PostgreSQL principal quotas", () => {
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
      control.cleanupExecutor = tx;
      try {
        await listing();
        expect((await rows()).map((row) => row.used)).toEqual([1n]);
        const remaining = await tx.execute(
          sql`select organization_id from principal_quota_counters`,
        );
        expect(remaining.rows).toEqual([
          { organization_id: "unrelated-fixture" },
        ]);
      } finally {
        control.cleanupExecutor = undefined;
      }
    });
  });
  it("admits exact bytes and denies overflow without increasing usage", async () => {
    await seed("upload_bytes", DAILY_UPLOAD_BYTES - 6);
    expect(await upload(6)).toBe("allowed");
    expect(await upload(1)).toBe("exhausted");
    expect((await rows())[0].used).toBe(524288000n);
  });
  it("serializes concurrent first creation and admits exactly 120 listing calls", async () => {
    control.instant = new Date(
      Math.ceil(Date.now() / 60000) * 60000 + 60000,
    ).toISOString();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 132 }, listing),
    );
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      120,
    );
    const rejected = outcomes.filter((item) => item.status === "rejected");
    expect(rejected).toHaveLength(12);
    for (const item of rejected)
      expect(item.reason).toMatchObject({
        code: "TOO_MANY_REQUESTS",
        data: { reason: "RATE_LIMITED" },
      });
    expect((await rows()).map((row) => row.used)).toEqual([120n]);
  }, 20000);
  it("keeps Users and Organizations independent", async () => {
    await seed("listing_calls", 120);
    await expect(listing()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await enforceListingLimit({ ...principal, userId: "second-reader" }, {});
    const second = `${organizationId}-second`;
    try {
      await enforceListingLimit({ ...principal, organizationId: second }, {});
      expect(
        (await rows())
          .map((row) => row.used)
          .sort((left, right) => Number(left - right)),
      ).toEqual([1n, 120n]);
      expect(
        (
          await db
            .select()
            .from(counters)
            .where(eq(counters.organizationId, second))
        )[0].used,
      ).toBe(1n);
    } finally {
      await db.delete(counters).where(eq(counters.organizationId, second));
    }
  });
  it("resets expired minute rows and keeps repeated denials to one stable row", async () => {
    await seed("listing_calls", 120, new Date(Date.now() - 120000));
    await listing();
    expect((await rows())[0].used).toBe(1n);
    const start = new Date(Math.ceil(Date.now() / 60000) * 60000 + 60000);
    await db
      .update(counters)
      .set({
        used: 120n,
        windowStart: start,
        expiresAt: new Date(start.getTime() + 60000),
      })
      .where(owned);
    for (let i = 0; i < 4; i++)
      await expect(listing()).rejects.toMatchObject({
        data: { reason: "RATE_LIMITED" },
      });
    expect((await rows()).map((row) => row.used)).toEqual([120n]);
  });
  it("rolls back reservations when the owning upload transaction fails", async () => {
    await expect(
      db.transaction(async (tx) => {
        expect(
          await consumeUploadBytes(tx, {
            partnerOrganizationId: organizationId,
            bytes: 6,
          }),
        ).toBe("allowed");
        throw new Error("simulated document failure");
      }),
    ).rejects.toThrow("simulated document failure");
    expect(await rows()).toEqual([]);
  });
  it("does not turn database failures into quota errors", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`create temporary table principal_quota_counters (like public.principal_quota_counters including all, check (used = 0)) on commit drop`,
        );
        await consumeUploadBytes(tx, {
          partnerOrganizationId: organizationId,
          bytes: 6,
        });
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    expect(await rows()).toEqual([]);
  });
  it("propagates a listing counter database failure rather than returning 429", async () => {
    control.failConsumption = true;
    await expect(listing()).rejects.toMatchObject({ cause: { code: "23514" } });
    expect(await rows()).toEqual([]);
  });
  it("does not regress a newer stored window after a clock correction", async () => {
    const future = new Date(Date.now() + 2 * 86400000);
    await seed("upload_bytes", DAILY_UPLOAD_BYTES, future);
    expect(await upload(1)).toBe("exhausted");
    expect((await rows())[0].windowStart.toISOString()).toBe(
      future.toISOString(),
    );
  });
  it("uses the post-lock UTC day when a waiting upload crosses midnight", async () => {
    await seed(
      "upload_bytes",
      DAILY_UPLOAD_BYTES,
      new Date("2026-11-03T00:00:00Z"),
    );
    let instant = "2026-11-03T23:59:59Z";
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(counters).where(owned).for("update");
      locked();
      await gate;
    });
    await held;
    const waiter = db.transaction((tx) =>
      consumeUploadBytes(
        controlledClock(tx, () => instant),
        { partnerOrganizationId: organizationId, bytes: 6 },
      ),
    );
    try {
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const result = await db.execute(
          sql`select exists(select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query like '%principal_quota_counters%') as waiting`,
        );
        if (result.rows[0].waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      instant = "2026-11-04T00:00:00Z";
    } finally {
      release();
    }
    await blocker;
    expect(await waiter).toBe("allowed");
    const [row] = await rows();
    expect(row.used).toBe(6n);
    expect(row.windowStart.toISOString()).toBe("2026-11-04T00:00:00.000Z");
    expect(row.expiresAt.toISOString()).toBe("2026-11-05T00:00:00.000Z");
  });
  it("admits the exact UTC boundary and does not regress on a backward clock", async () => {
    await seed(
      "upload_bytes",
      DAILY_UPLOAD_BYTES,
      new Date("2026-11-03T00:00:00Z"),
    );
    const consumeAt = (instant: string) =>
      db.transaction((tx) =>
        consumeUploadBytes(
          controlledClock(tx, () => instant),
          { partnerOrganizationId: organizationId, bytes: 6 },
        ),
      );
    expect(await consumeAt("2026-11-03T23:59:59.999Z")).toBe("exhausted");
    expect(await consumeAt("2026-11-04T00:00:00Z")).toBe("allowed");
    expect(await consumeAt("2026-11-03T23:59:59Z")).toBe("allowed");
    expect((await rows())[0].used).toBe(12n);
  });
  it("allows a full listing allowance on both sides of a fixed-minute boundary", async () => {
    control.instant = "2099-11-03T23:59:59.999Z";
    await listing();
    await db.update(counters).set({ used: 119n }).where(owned);
    await listing();
    await expect(listing()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    control.instant = "2099-11-04T00:00:00Z";
    await listing();
    expect((await rows())[0].used).toBe(1n);
    expect((await rows())[0].windowStart.toISOString()).toBe(
      "2099-11-04T00:00:00.000Z",
    );
    await db.update(counters).set({ used: 119n }).where(owned);
    await listing();
    expect((await rows())[0].used).toBe(120n);
  });
  it("preserves admitted and denied outcomes when best-effort cleanup fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    control.failCleanup = true;
    await expect(listing()).resolves.toBeUndefined();
    const start = new Date(Date.now() + 120000);
    await db
      .update(counters)
      .set({
        used: 120n,
        windowStart: start,
        expiresAt: new Date(start.getTime() + 60000),
      })
      .where(owned);
    await expect(listing()).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(log.mock.calls).toHaveLength(2);
    for (const [message, error] of log.mock.calls) {
      expect(message).toBe("[Principal quotas] Expired counter cleanup failed");
      expect(error).toBeInstanceOf(Error);
    }
    control.failCleanup = false;
  });
  it("skips locked expired rows and never deletes a concurrent refreshed window", async () => {
    await seed("listing_calls", 120, new Date("2000-01-01"));
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(counters).where(owned).for("update");
      ready();
      await gate;
    });
    await held;
    try {
      expect(
        await db.transaction((tx) =>
          deleteExpiredQuotaRows(ownedCleanup(tx, [organizationId])),
        ),
      ).toBe(0);
    } finally {
      release();
    }
    await blocker;
    await listing();
    expect(
      await db.transaction((tx) =>
        deleteExpiredQuotaRows(ownedCleanup(tx, [organizationId])),
      ),
    ).toBe(0);
    expect((await rows())[0].used).toBe(1n);
    await db
      .update(counters)
      .set({
        windowStart: new Date("2000-01-01"),
        expiresAt: new Date("2000-01-02"),
      })
      .where(owned);
    const deleted = await Promise.all(
      [0, 1].map(() =>
        db.transaction((tx) =>
          deleteExpiredQuotaRows(ownedCleanup(tx, [organizationId])),
        ),
      ),
    );
    expect(deleted.reduce((sum, count) => sum + count, 0)).toBe(1);
    expect(await rows()).toEqual([]);
  });
  it("keeps a fresh allowance when cleanup and expired-window consumption race", async () => {
    await seed("listing_calls", 120, new Date("2000-01-01"));
    await Promise.all([
      listing(),
      db.transaction((tx) =>
        deleteExpiredQuotaRows(ownedCleanup(tx, [organizationId])),
      ),
    ]);
    expect((await rows()).map((row) => row.used)).toEqual([1n]);
  });
  it("retries creation if cleanup deletes the row between insert and lock", async () => {
    await seed("upload_bytes", 1, new Date("2000-01-01"));
    let attempts = 0;
    const result = await db.transaction((tx) =>
      consumeUploadBytes(
        new Proxy(tx, {
          get(target, key) {
            if (key === "insert")
              return () => ({
                values: (values: typeof counters.$inferInsert) => ({
                  onConflictDoNothing: async () => {
                    await target
                      .insert(counters)
                      .values(values)
                      .onConflictDoNothing();
                    attempts++;
                    if (attempts === 1) await db.delete(counters).where(owned);
                  },
                }),
              });
            const value = Reflect.get(target, key, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
        { partnerOrganizationId: organizationId, bytes: 6 },
      ),
    );
    expect(result).toBe("allowed");
    expect(attempts).toBe(2);
    expect((await rows())[0].used).toBe(6n);
  });
  it("fails operationally after bounded missing-row retries, never as 429", async () => {
    let attempts = 0;
    await expect(
      db.transaction((tx) =>
        consumeUploadBytes(
          new Proxy(tx, {
            get(target, key) {
              if (key === "select")
                return () => ({
                  from: () => ({
                    where: () => ({
                      for: async () => {
                        attempts++;
                        return [];
                      },
                    }),
                  }),
                });
              const value = Reflect.get(target, key, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          }),
          { partnerOrganizationId: organizationId, bytes: 6 },
        ),
      ),
    ).rejects.toThrow("Quota principal lock unavailable after cleanup races");
    expect(attempts).toBe(3);
    expect(await rows()).toEqual([]);
  });
  it.each([
    {
      kind: "upload_bytes" as const,
      userKey: "reader",
      used: 0n,
      windowStart: new Date(0),
      expiresAt: new Date(1),
    },
    {
      kind: "listing_calls" as const,
      userKey: "",
      used: 0n,
      windowStart: new Date(0),
      expiresAt: new Date(1),
    },
    {
      kind: "listing_calls" as const,
      userKey: "reader",
      used: -1n,
      windowStart: new Date(0),
      expiresAt: new Date(1),
    },
    {
      kind: "listing_calls" as const,
      userKey: "reader",
      used: 1n,
      windowStart: new Date(1),
      expiresAt: new Date(0),
    },
  ])(
    "rejects invalid persisted kind, key, usage or window $kind/$userKey/$used",
    async (row) => {
      await expect(
        db.insert(counters).values({ ...row, organizationId }),
      ).rejects.toMatchObject({ cause: { code: "23514" } });
      expect(await rows()).toEqual([]);
    },
  );
  it("bounds cleanup and preserves active rows in an isolated PostgreSQL temporary table", async () => {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`create temporary table principal_quota_counters (like public.principal_quota_counters including all) on commit drop`,
      );
      await tx.execute(
        sql`insert into principal_quota_counters select 'listing_calls', ${organizationId}, i::text, '2000-01-01'::timestamptz, '2000-01-02'::timestamptz, 1 from generate_series(1, ${QUOTA_CLEANUP_BATCH_SIZE + 3}) i`,
      );
      await tx.execute(
        sql`insert into principal_quota_counters values ('listing_calls', ${organizationId}, 'active', '2099-01-01', '2099-01-02', 1)`,
      );
      expect(await deleteExpiredQuotaRows(tx)).toBe(500);
      expect(await deleteExpiredQuotaRows(tx)).toBe(3);
      expect(await deleteExpiredQuotaRows(tx)).toBe(0);
      const remaining = await tx.execute(
        sql`select user_key from principal_quota_counters`,
      );
      expect(remaining.rows).toEqual([{ user_key: "active" }]);
    });
  });
});
