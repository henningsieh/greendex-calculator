// @vitest-environment node

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../../../..");
const seedModulePath = resolve(repoRoot, "apps/calculator/scripts/seed.ts");
const commandTimeoutMs = 300_000;
const unrelatedId = `contract-${randomUUID()}`;

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

async function runSeedModule(expression: string): Promise<string> {
  const script = `
    (async () => {
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const { Pool } = await import("pg");
      const schema = await import("@greendex/database/schema");
      const seedModule = await import(process.env.SEED_MODULE);
      const client = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
      try {
        const db = drizzle(client, { schema });
        ${expression}
      } finally {
        await client.end();
      }
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  // The seed module's dependencies (pg, drizzle-orm) resolve from this package,
  // not from the repository root.
  const { stdout } = await execute("pnpm", ["exec", "tsx", "-e", script], {
    cwd: resolve(import.meta.dirname, "../.."),
    timeout: commandTimeoutMs,
    env: { ...process.env, SEED_MODULE: seedModulePath },
  });
  const lines = String(stdout).trim().split("\n");
  return lines[lines.length - 1] as string;
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

afterAll(async () => {
  const client = pool();
  try {
    await client.query("DELETE FROM organization WHERE id = $1", [unrelatedId]);
  } finally {
    await client.end();
  }
});

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

  it(
    "resets only seed-owned rows",
    async () => {
      // Precondition: the shared database is seeded before the reset runs.
      await seed();
      const client = pool();
      try {
        await client.query(
          `INSERT INTO organization (id, name, slug, country, created_at)
         VALUES ($1, 'Seed Contract Unrelated', $1, 'DE', now())`,
          [unrelatedId],
        );
      } finally {
        await client.end();
      }

      const refusal = await runSeedModule(
        "await seedModule.resetSeedData(db, { confirmSeedReset: false });",
      ).then(
        () => "accepted",
        (error: unknown) => String(error),
      );
      expect(refusal).toMatch(/explicit/i);

      try {
        await runSeedModule(
          "await seedModule.resetSeedData(db, { confirmSeedReset: true });",
        );

        const after = pool();
        try {
          const unrelated = await after.query<{ id: string }>(
            "SELECT id FROM organization WHERE id = $1",
            [unrelatedId],
          );
          expect(unrelated.rows).toHaveLength(1);
          // Reset removes seed-owned rows and does not recreate them.
          const canonical = await after.query<{ slug: string }>(
            "SELECT slug FROM organization WHERE slug = 'seed-org'",
          );
          expect(canonical.rows).toHaveLength(0);
        } finally {
          await after.end();
        }
      } finally {
        // Leave the shared database seeded for every other consumer.
        await seed();
      }

      const restored = pool();
      try {
        const canonical = await restored.query<{ slug: string }>(
          "SELECT slug FROM organization WHERE slug = 'seed-org'",
        );
        expect(canonical.rows).toHaveLength(1);
      } finally {
        await restored.end();
      }
    },
    commandTimeoutMs * 2,
  );
});
