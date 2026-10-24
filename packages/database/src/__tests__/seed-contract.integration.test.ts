// @vitest-environment node

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../../..");
const commandTimeoutMs = 300_000;

function pool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000,
  });
}

async function seed() {
  await execute("pnpm", ["run", "db:seed"], {
    cwd: repoRoot,
    timeout: commandTimeoutMs,
  });
}

async function duplicates(client: Pool) {
  const result = await client.query<{ duplicates: number }>(`
    SELECT (
      (SELECT count(*) FROM (SELECT slug FROM organization GROUP BY slug HAVING count(*) > 1) AS o) +
      (SELECT count(*) FROM (SELECT email FROM "user" GROUP BY email HAVING count(*) > 1) AS u) +
      (SELECT count(*) FROM (SELECT organization_id, name FROM project GROUP BY organization_id, name HAVING count(*) > 1) AS p)
    )::int AS duplicates
  `);
  return result.rows[0]!.duplicates;
}

describe("seed contract on the shared development database", () => {
  it(
    "repeats the CLI seed without creating duplicate identities",
    async () => {
      await seed();
      const client = pool();
      try {
        expect(await duplicates(client)).toBe(0);
        const canonical = await client.query<{ slug: string }>(
          "SELECT slug FROM organization WHERE slug IN ('seed-org', 'seed-partner-org') ORDER BY slug",
        );
        expect(canonical.rows.map(({ slug }) => slug)).toEqual([
          "seed-org",
          "seed-partner-org",
        ]);
      } finally {
        await client.end();
      }

      await seed();
      const second = pool();
      try {
        expect(await duplicates(second)).toBe(0);
      } finally {
        await second.end();
      }
    },
    commandTimeoutMs,
  );
});
