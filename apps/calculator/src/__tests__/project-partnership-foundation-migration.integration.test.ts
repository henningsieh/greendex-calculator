import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../../../packages/database/src/migrations",
);
const projectPartnershipInvariantMigrationIndex = 17;

function databaseUrl(databaseName: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function adminDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  return url.toString();
}

async function applyMigrationsThrough(pool: Pool, migrationIndex: number) {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => Number(filename.slice(0, 4)) <= migrationIndex)
    .sort();

  for (const filename of filenames) {
    await pool.query(
      await readFile(resolve(migrationsDirectory, filename), "utf8"),
    );
  }
}

async function applyMigration(pool: Pool, migrationIndex: number) {
  const filename = (await readdir(migrationsDirectory)).find(
    (entry) =>
      entry.endsWith(".sql") && Number(entry.slice(0, 4)) === migrationIndex,
  );

  if (!filename) throw new Error(`Migration ${migrationIndex} is missing`);

  await pool.query(
    await readFile(resolve(migrationsDirectory, filename), "utf8"),
  );
}

async function removeProjectPartnershipInvariantEnforcement(pool: Pool) {
  await pool.query(`
    DROP TRIGGER IF EXISTS "project_host_organization_invariants" ON "project";
    DROP TRIGGER IF EXISTS "project_partnership_organization_invariants" ON "project_partner_organization";
    DROP TRIGGER IF EXISTS "project_participation_organization_invariants" ON "project_participant";
    DROP FUNCTION IF EXISTS "check_project_organization_invariants"();
    DROP FUNCTION IF EXISTS "assert_project_organization_invariants"(text);
  `);
}

async function createDisposableDatabase() {
  const databaseName = `project_partnership_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: adminDatabaseUrl(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  return {
    databaseName,
    adminPool,
    pool: new Pool({ connectionString: databaseUrl(databaseName), max: 1 }),
  };
}

type DisposableDatabase = Awaited<ReturnType<typeof createDisposableDatabase>>;

async function dropDisposableDatabase(database: DisposableDatabase) {
  await database.pool.end();
  await database.adminPool.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
    [database.databaseName],
  );
  await database.adminPool.query(
    `DROP DATABASE IF EXISTS "${database.databaseName}"`,
  );
  await database.adminPool.end();
}

async function seedLegacyParticipation(pool: Pool) {
  await pool.query(`
    INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
    VALUES ('owner', 'Legacy Organization Administrator', 'owner@example.com', true, now(), now());

    INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
    VALUES ('participant', 'Legacy Participant', 'participant@example.com', true, now(), now());

    INSERT INTO "organization" ("id", "name", "slug", "created_at")
    VALUES ('hosting-organization', 'Hosting Organization', 'hosting-organization', now());

    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
    VALUES ('participant-membership', 'hosting-organization', 'participant', 'member', now());

    INSERT INTO "project" ("id", "name", "start_date", "end_date", "location", "country", "responsible_user_id", "organization_id", "archived", "created_at", "updated_at")
    VALUES ('project', 'Legacy Project', '2026-01-01', '2026-01-02', 'Berlin', 'DE', 'owner', 'hosting-organization', false, now(), now());

    INSERT INTO "project_participant" ("id", "project_id", "user_id", "member_id", "country", "created_at", "updated_at")
    VALUES ('participation', 'project', 'participant', 'participant-membership', 'DE', now(), now());
  `);
}

describe("Project Partnership foundation migration", () => {
  const databases: DisposableDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map(dropDisposableDatabase));
  });

  it("backfills existing Calculator Project Participations before requiring the new identity fields", async () => {
    const database = await createDisposableDatabase();
    databases.push(database);
    await applyMigrationsThrough(database.pool, 14);
    await seedLegacyParticipation(database.pool);

    await expect(applyMigration(database.pool, 15)).resolves.toBeUndefined();

    const participation = await database.pool.query(
      `SELECT "represented_organization_id", "display_name", "email", "user_id", "country"
       FROM "project_participant"
       WHERE "id" = 'participation'`,
    );

    expect(participation.rows).toEqual([
      {
        represented_organization_id: "hosting-organization",
        display_name: "Legacy Participant",
        email: "participant@example.com",
        user_id: "participant",
        country: "DE",
      },
    ]);
  });

  it("repairs the historical 0015 state with backfill and invariant enforcement", async () => {
    const database = await createDisposableDatabase();
    databases.push(database);
    await applyMigrationsThrough(database.pool, 14);
    await seedLegacyParticipation(database.pool);
    await applyMigration(database.pool, 15);
    await database.pool.query(
      `UPDATE "project_participant" SET "email" = NULL WHERE "id" = 'participation'`,
    );
    await removeProjectPartnershipInvariantEnforcement(database.pool);
    await applyMigration(database.pool, 16);

    await expect(
      applyMigration(database.pool, projectPartnershipInvariantMigrationIndex),
    ).resolves.toBeUndefined();

    const participation = await database.pool.query(
      `SELECT "email" FROM "project_participant" WHERE "id" = 'participation'`,
    );
    expect(participation.rows).toEqual([{ email: "participant@example.com" }]);

    await expect(
      database.pool.query(
        `INSERT INTO "project_partner_organization" ("id", "project_id", "organization_id")
         VALUES ('invalid-host-partnership', 'project', 'hosting-organization')`,
      ),
    ).rejects.toThrow(/Hosting Organization/i);
  });

  it("enforces Hosting and represented Organization invariants in fresh PostgreSQL databases", async () => {
    const database = await createDisposableDatabase();
    databases.push(database);
    await applyMigrationsThrough(
      database.pool,
      projectPartnershipInvariantMigrationIndex,
    );
    await database.pool.query(`
      INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
      VALUES ('owner', 'Organization Administrator', 'organization-administrator@example.com', true, now(), now());

      INSERT INTO "organization" ("id", "name", "slug", "created_at") VALUES
        ('hosting-organization', 'Hosting Organization', 'hosting-organization', now()),
        ('partner-organization', 'Partner Organization', 'partner-organization', now()),
        ('unrelated-organization', 'Unrelated Organization', 'unrelated-organization', now());

      INSERT INTO "project" ("id", "name", "start_date", "end_date", "location", "country", "responsible_user_id", "organization_id", "archived", "created_at", "updated_at")
      VALUES ('project', 'Project', '2026-01-01', '2026-01-02', 'Berlin', 'DE', 'owner', 'hosting-organization', false, now(), now());
    `);

    await expect(
      database.pool.query(
        `INSERT INTO "project_partner_organization" ("id", "project_id", "organization_id")
         VALUES ('invalid-host-partnership', 'project', 'hosting-organization')`,
      ),
    ).rejects.toThrow(/Hosting Organization/i);

    await expect(
      database.pool.query(
        `INSERT INTO "project_participant" ("id", "project_id", "represented_organization_id", "display_name")
         VALUES ('invalid-participation', 'project', 'unrelated-organization', 'Unrelated Participant')`,
      ),
    ).rejects.toThrow(/represented Organization/i);

    await database.pool.query(
      `INSERT INTO "project_partner_organization" ("id", "project_id", "organization_id")
       VALUES ('partnership', 'project', 'partner-organization')`,
    );
    await expect(
      database.pool.query(
        `INSERT INTO "project_participant" ("id", "project_id", "represented_organization_id", "display_name")
         VALUES ('partner-participation', 'project', 'partner-organization', 'Partner Participant')`,
      ),
    ).resolves.toBeDefined();

    await expect(
      database.pool.query(
        `DELETE FROM "project_partner_organization" WHERE "id" = 'partnership'`,
      ),
    ).rejects.toThrow(/represented Organization/i);
  });
});
