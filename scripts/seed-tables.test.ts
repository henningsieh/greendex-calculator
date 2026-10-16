import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { SeedDatabase } from "../apps/calculator/scripts/seed";
import * as helpers from "../apps/calculator/scripts/seed-tables";

function database(saved: Record<string, string>[]) {
  const inserted: unknown[] = [];
  const queries: { sql: string; params: unknown[] }[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: async (predicate: SQL) => {
          queries.push(new PgDialect().sqlToQuery(predicate));
          return saved;
        },
      }),
    }),
    insert: () => ({
      values: (rows: unknown[]) => ({
        onConflictDoNothing: async () => {
          inserted.push(...rows);
        },
      }),
    }),
  } as unknown as SeedDatabase;
  return { db, inserted, queries };
}

describe("seed candidate lookups", () => {
  it("does no lookup for empty input for every helper", async () => {
    for (const ensure of Object.values(helpers)) {
      const { db, queries, inserted } = database([]);
      await ensure(db, []);
      expect({ queries, inserted }).toEqual({ queries: [], inserted: [] });
    }
  });

  it("scopes single keys and inserts only missing candidates across retries", async () => {
    const state = database([{ id: "saved" }]);
    const rows = [
      { id: "saved", name: "Saved", email: "saved@example.test" },
      { id: "new", name: "New", email: "new@example.test" },
    ];
    await helpers.ensureSeedUsers(state.db, rows);
    expect(state.queries[0]?.sql).toBe('"user"."id" in ($1, $2)');
    expect(state.queries[0]?.params).toEqual(["saved", "new"]);
    expect(state.inserted).toEqual([rows[1]]);
  });

  it("keeps distinct composite keys even when delimiter concatenation would collide", async () => {
    const state = database([{ organizationId: "a:b", userId: "c" }]);
    const rows = [
      {
        id: "one",
        organizationId: "a:b",
        userId: "c",
        role: "member",
        createdAt: new Date(0),
      },
      {
        id: "two",
        organizationId: "a",
        userId: "b:c",
        role: "member",
        createdAt: new Date(0),
      },
    ];
    await helpers.ensureSeedMemberships(state.db, rows);
    expect(state.queries[0]?.params).toEqual(["a:b", "c", "a", "b:c"]);
    expect(state.queries[0]?.sql).toContain(" or ");
    expect(state.inserted).toEqual([rows[1]]);
  });
});
