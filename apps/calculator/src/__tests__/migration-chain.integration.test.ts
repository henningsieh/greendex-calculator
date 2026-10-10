import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const execute = promisify(execFile);
const databasePackage = resolve(
  import.meta.dirname,
  "../../../../packages/database",
);
const migrations = resolve(databasePackage, "src/migrations");
const mainMigrationCount = 17;

const snapshotSchema = z.object({
  id: z.string(),
  prevIds: z.array(z.string()),
  version: z.string(),
  dialect: z.string(),
});

async function folders() {
  const names = await readdir(migrations);
  const dirs: string[] = [];
  for (const name of names.sort()) {
    if ((await stat(resolve(migrations, name))).isDirectory()) dirs.push(name);
  }
  return dirs;
}

async function migrate(databaseUrl: string, migrationDirectory = migrations) {
  const configDirectory = await mkdtemp(
    resolve(tmpdir(), "greendex-migration-config-"),
  );
  try {
    const config = resolve(configDirectory, "drizzle.config.cjs");
    await writeFile(
      config,
      `module.exports = ${JSON.stringify({ dialect: "postgresql", out: migrationDirectory, dbCredentials: { url: databaseUrl } })};`,
    );
    await execute(
      "pnpm",
      ["exec", "drizzle-kit", "migrate", "--config", config],
      { cwd: databasePackage },
    );
  } finally {
    await rm(configDirectory, { recursive: true, force: true });
  }
}

async function withDatabase(run: (pool: Pool, url: string) => Promise<void>) {
  const name = `migration_chain_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString(), max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    await run(pool, url.toString());
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
}

async function expectSharedAndClaimTables(pool: Pool) {
  const tables = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  expect(tables.rows.map(({ tablename }) => tablename)).toEqual(
    expect.arrayContaining([
      "organization",
      "project",
      "user",
      "project_participant",
      "participant_journey",
      "project_partner_organization",
      "claim",
      "proof_document",
      "travel_cost_entry",
      "cost_allocation",
      "payout_account",
    ]),
  );
  const history = await pool.query(
    "SELECT id FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  expect(history.rows.length).toBe((await folders()).length);
}

describe("merged migration chain", () => {
  it("keeps main as the prefix and has one ordered SQL and snapshot history", async () => {
    const dirs = await folders();
    expect(dirs.length).toBe(36);
    expect(dirs).toEqual([...dirs].sort());
    const suffixes = dirs.map((d) => d.slice(15));
    expect(new Set(suffixes).size).toBe(dirs.length);
    for (const expected of [
      "minor_xavin",
      "skinny_ronan",
      "certain_terrax",
      "project_partnership_foundation",
      "awesome_the_enforcers",
    ]) {
      expect(suffixes).toContain(expected);
    }
    for (const dir of dirs) {
      expect(dir.slice(0, 14)).toMatch(/^\d{14}$/);
      const sql = await readFile(
        resolve(migrations, dir, "migration.sql"),
        "utf8",
      );
      expect(sql.length).toBeGreaterThan(0);
      const snapshot = snapshotSchema
        .loose()
        .parse(
          JSON.parse(
            await readFile(resolve(migrations, dir, "snapshot.json"), "utf8"),
          ),
        );
      expect(snapshot.version).toBe("8");
      expect(snapshot.prevIds.length).toBeGreaterThan(0);
    }
  });

  it("migrates an empty database through the normal db:migrate command", async () => {
    await withDatabase(async (pool, url) => {
      await execute("pnpm", ["run", "db:migrate"], {
        cwd: databasePackage,
        env: { ...process.env, DATABASE_URL: url },
      });
      await expectSharedAndClaimTables(pool);
      await migrate(url);
      await expectSharedAndClaimTables(pool);
    });
  }, 60_000);

  it("appends Cost Tracker to main without replacing shared identities", async () => {
    const prefix = await mkdtemp(resolve(tmpdir(), "greendex-main-migrations-"));
    try {
      const dirs = await folders();
      for (const dir of dirs.slice(0, mainMigrationCount)) {
        await cp(resolve(migrations, dir), resolve(prefix, dir), {
          recursive: true,
        });
      }
      await withDatabase(async (pool, url) => {
        await migrate(url, prefix);
        await pool.query(`
          INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
          VALUES ('owner', 'Owner', 'owner@example.com', true, now(), now());
          INSERT INTO organization (id, name, slug, country, created_at)
          VALUES ('organization', 'Organization', 'organization', 'DE', now());
          INSERT INTO member (id, organization_id, user_id, created_at)
          VALUES ('membership', 'organization', 'owner', now());
          INSERT INTO project (id, name, start_date, end_date, location, country, responsible_user_id, organization_id)
          VALUES ('project', 'Project', now(), now(), 'Berlin', 'DE', 'owner', 'organization');
          INSERT INTO project_participant (id, project_id, user_id, member_id, country)
          VALUES ('participation', 'project', 'owner', 'membership', 'DE');
        `);
        const identityQuery =
          "SELECT oid, relname FROM pg_class WHERE relname IN ('user', 'organization', 'project', 'project_participant') ORDER BY relname";
        const identities = await pool.query(identityQuery);
        await migrate(url);
        await expectSharedAndClaimTables(pool);
        expect((await pool.query(identityQuery)).rows).toEqual(identities.rows);
        expect(
          (
            await pool.query(
              "SELECT id, project_id, user_id, represented_organization_id, display_name FROM project_participant",
            )
          ).rows,
        ).toEqual([
          {
            id: "participation",
            project_id: "project",
            user_id: "owner",
            represented_organization_id: "organization",
            display_name: "Owner",
          },
        ]);
        expect(
          (await pool.query("SELECT role FROM member WHERE id = 'membership'"))
            .rows,
        ).toEqual([{ role: "participant" }]);
      });
    } finally {
      await rm(prefix, { recursive: true, force: true });
    }
  }, 60_000);
});
