// @vitest-environment node

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(import.meta.dirname, "../migrations");

describe("shared migration journal", () => {
  it("has every migration file applied in order, so neither app runs on a stale database", async () => {
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    expect(files.length).toBeGreaterThan(0);
    const expected = await Promise.all(
      files.map(async (file) => {
        const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
        return createHash("sha256").update(sql).digest("hex");
      }),
    );

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10_000,
    });
    try {
      const applied = await pool.query<{ hash: string }>(
        "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id",
      );
      expect(applied.rows.map(({ hash }) => hash)).toEqual(expected);
    } finally {
      await pool.end();
    }
  }, 30_000);
});
