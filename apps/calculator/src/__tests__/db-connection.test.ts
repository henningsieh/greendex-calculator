import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

describe("configured shared PostgreSQL connection", () => {
  it("uses PostgreSQL without imposing an obsolete SSL configuration", () => {
    expect(Boolean(process.env.DATABASE_URL)).toBe(true);
    expect(["postgres:", "postgresql:"]).toContain(
      new URL(process.env.DATABASE_URL!).protocol,
    );
  });

  it("executes queries with the configured connection and Drizzle", async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
    try {
      const result = await drizzle(pool).execute("SELECT 1 AS value");
      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await pool.end();
    }
  });
});
