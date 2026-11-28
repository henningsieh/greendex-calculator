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

async function duplicateGroups(client: Pool) {
  const result = await client.query<{ key: string; size: number }>(`
    WITH identities(kind, identity) AS (
      SELECT 'organization', jsonb_build_array(slug) FROM organization
      UNION ALL SELECT 'user', jsonb_build_array(email) FROM "user"
      UNION ALL SELECT 'project', jsonb_build_array(organization_id, name) FROM project
    )
    SELECT md5(jsonb_build_array(kind, identity)::text) AS key, count(*)::int AS size
    FROM identities GROUP BY kind, identity HAVING count(*) > 1
    ORDER BY key
  `);
  return new Map(result.rows.map(({ key, size }) => [key, size]));
}

async function identityFingerprints(client: Pool) {
  const result = await client.query<{ kind: string; fingerprint: string }>(`
    WITH identities(kind, identity) AS (
      SELECT 'organization', jsonb_build_array(id, slug) FROM organization
      UNION ALL SELECT 'user', jsonb_build_array(id, email) FROM "user"
      UNION ALL SELECT 'project', jsonb_build_array(id, organization_id, name) FROM project
    )
    SELECT kind, md5(jsonb_agg(identity ORDER BY identity)::text) AS fingerprint
    FROM identities GROUP BY kind ORDER BY kind
  `);
  return result.rows;
}

describe("seed contract on the shared development database", () => {
  it(
    "repeats the CLI seed without creating duplicate identities",
    async () => {
      const client = pool();
      try {
        const before = await duplicateGroups(client);
        await seed();
        for (const [key, size] of await duplicateGroups(client)) {
          expect(
            size,
            "The seed must not add a duplicate identity",
          ).toBeLessThanOrEqual(before.get(key) ?? 0);
        }
        const seeded = await client.query<{ slug: string }>(
          "SELECT slug FROM organization WHERE slug IN ('seed-org', 'seed-partner-org') ORDER BY slug",
        );
        expect(seeded.rows.map(({ slug }) => slug)).toEqual([
          "seed-org",
          "seed-partner-org",
        ]);

        const first = await identityFingerprints(client);
        await seed();
        expect(await identityFingerprints(client)).toEqual(first);
      } finally {
        await client.end();
      }
    },
    commandTimeoutMs,
  );
});
