import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

const journalSchema = z.object({
  version: z.string(),
  dialect: z.literal("postgresql"),
  entries: z.array(
    z.object({
      idx: z.number().int(),
      version: z.string(),
      when: z.number().int(),
      tag: z.string(),
      breakpoints: z.boolean(),
    }),
  ),
});

async function journal() {
  return journalSchema.parse(
    JSON.parse(await readFile(resolve(migrations, "meta/_journal.json"), "utf8")),
  );
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
    "SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  expect(history.rows.map(({ created_at }) => Number(created_at))).toEqual(
    (await journal()).entries.map(({ when }) => when),
  );
}

describe("merged migration chain", () => {
  it("keeps main as the prefix and has one ordered SQL and snapshot history", async () => {
    const { entries } = await journal();
    expect(entries[15].tag).toBe("0015_skinny_ronan");
    expect(entries[16].tag).toBe("0016_certain_terrax");
    expect(entries[17].tag).toBe("0017_project_partnership_foundation");
    expect(new Set(entries.map(({ tag }) => tag)).size).toBe(entries.length);
    expect(
      (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort(),
    ).toEqual(entries.map(({ tag }) => `${tag}.sql`));
    let previousId = "00000000-0000-0000-0000-000000000000";
    for (const [index, entry] of entries.entries()) {
      expect(entry.idx).toBe(index);
      expect(entry.tag.slice(0, 4)).toBe(String(index).padStart(4, "0"));
      if (index > 0) expect(entry.when).toBeGreaterThan(entries[index - 1].when);
      const snapshot = JSON.parse(
        await readFile(
          resolve(
            migrations,
            "meta",
            `${String(index).padStart(4, "0")}_snapshot.json`,
          ),
          "utf8",
        ),
      );
      expect(snapshot.prevId).toBe(previousId);
      previousId = snapshot.id;
      if (index >= 16)
        expect(
          snapshot.tables["public.organization"].columns.country.notNull,
        ).toBe(true);
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
      await cp(migrations, prefix, { recursive: true });
      const mainJournal = await journal();
      mainJournal.entries = mainJournal.entries.slice(0, mainMigrationCount);
      await writeFile(
        resolve(prefix, "meta/_journal.json"),
        JSON.stringify(mainJournal),
      );
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
