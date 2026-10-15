import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../../../packages/database/src/migrations",
);
const priorMigrationIndex = 9;
const cutoverMigrationIndex = 10;

function disposableDatabaseUrl(databaseName: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function adminDatabaseUrl(): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  return url.toString();
}

async function v3MigrationDirs(): Promise<string[]> {
  const names = await readdir(migrationsDirectory);
  const dirs: string[] = [];
  for (const name of names.sort()) {
    if ((await stat(resolve(migrationsDirectory, name))).isDirectory()) {
      dirs.push(name);
    }
  }
  return dirs;
}

async function applyPriorMigrations(pool: Pool): Promise<void> {
  const dirs = (await v3MigrationDirs()).slice(0, priorMigrationIndex + 1);

  for (const dir of dirs) {
    await pool.query(
      await readFile(resolve(migrationsDirectory, dir, "migration.sql"), "utf8"),
    );
  }
}

async function applyCutoverMigration(pool: Pool): Promise<void> {
  const dir = (await v3MigrationDirs())[cutoverMigrationIndex];

  if (!dir) {
    throw new Error("Project Shared Travel Leg cutover migration is missing");
  }

  await pool.query("BEGIN");
  try {
    await pool.query(
      await readFile(resolve(migrationsDirectory, dir, "migration.sql"), "utf8"),
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function createLegacyProject(pool: Pool): Promise<void> {
  await pool.query(`
    INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
    VALUES ('owner', 'Migration Organization Administrator', 'organization-administrator@example.com', true, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    INSERT INTO "organization" ("id", "name", "slug", "created_at")
    VALUES ('organization', 'Migration Organization', 'migration-organization', '2026-01-01T00:00:00.000Z');
    INSERT INTO "project" ("id", "name", "start_date", "end_date", "location", "country", "responsible_user_id", "organization_id", "archived", "created_at", "updated_at")
    VALUES ('project', 'Migration Project', '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 'Berlin', 'DE', 'owner', 'organization', false, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  `);
}

async function createDisposableDatabase(): Promise<{
  databaseName: string;
  adminPool: Pool;
  pool: Pool;
}> {
  const databaseName = `shared_travel_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: adminDatabaseUrl(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);

  return {
    databaseName,
    adminPool,
    pool: new Pool({
      connectionString: disposableDatabaseUrl(databaseName),
      max: 1,
    }),
  };
}

async function dropDisposableDatabase(
  databaseName: string,
  adminPool: Pool,
  pool: Pool,
): Promise<void> {
  await pool.end();
  await adminPool.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
    [databaseName],
  );
  await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await adminPool.end();
}

describe("Project Shared Travel Leg PostgreSQL cutover", () => {
  const databases: Awaited<ReturnType<typeof createDisposableDatabase>>[] = [];

  afterEach(async () => {
    await Promise.all(
      databases
        .splice(0)
        .map(({ databaseName, adminPool, pool }) =>
          dropDisposableDatabase(databaseName, adminPool, pool),
        ),
    );
  });

  it("preserves every supported legacy profile and keeps the legacy write contract operational", async () => {
    const database = await createDisposableDatabase();
    databases.push(database);
    await applyPriorMigrations(database.pool);
    await createLegacyProject(database.pool);

    const profiles = ["boat", "bus", "train", "car", "electricCar"] as const;
    for (const [index, profile] of profiles.entries()) {
      await database.pool.query(
        `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km", "description", "activity_date", "created_at", "updated_at")
         VALUES ($1, 'project', $2, $3, $4, $5, $6, $7)`,
        [
          `legacy-${profile}`,
          profile,
          `${index + 1}.5`,
          `${profile} legacy leg`,
          `2026-01-0${index + 1}T00:00:00.000Z`,
          `2026-02-0${index + 1}T00:00:00.000Z`,
          `2026-03-0${index + 1}T00:00:00.000Z`,
        ],
      );
    }

    const legacyRowsBeforeCutover = await database.pool.query(
      `SELECT "id", "project_id", "activity_type", "distance_km", "description", "activity_date", "created_at", "updated_at"
       FROM "project_activity"
       ORDER BY "created_at"`,
    );

    await applyCutoverMigration(database.pool);

    const canonicalRows = await database.pool.query(
      `SELECT "id", "project_id", "transport_emission_profile", "distance_km", "description", "travel_date", "created_at", "updated_at"
       FROM "project_shared_travel_leg"
       ORDER BY "created_at"`,
    );
    expect(canonicalRows.rows).toEqual(
      legacyRowsBeforeCutover.rows.map((legacyRow) => ({
        id: legacyRow.id,
        project_id: legacyRow.project_id,
        transport_emission_profile: legacyRow.activity_type,
        distance_km: legacyRow.distance_km,
        description: legacyRow.description,
        travel_date: legacyRow.activity_date,
        created_at: legacyRow.created_at,
        updated_at: legacyRow.updated_at,
      })),
    );

    const legacyRows = await database.pool.query(
      `SELECT "activity_type", "activity_date" FROM "project_activity" ORDER BY "created_at"`,
    );
    expect(legacyRows.rows).toEqual(
      legacyRowsBeforeCutover.rows.map((legacyRow) => ({
        activity_type: legacyRow.activity_type,
        activity_date: legacyRow.activity_date,
      })),
    );

    await database.pool.query(
      `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km", "description", "activity_date")
       VALUES ('legacy-write', 'project', 'electricCar', 42.5, 'Legacy write', '2026-04-01T00:00:00.000Z')`,
    );
    await database.pool.query(
      `UPDATE "project_activity"
       SET "activity_type" = 'train', "activity_date" = '2026-04-02T00:00:00.000Z'
       WHERE "id" = 'legacy-write'`,
    );

    await expect(
      database.pool.query(
        `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km")
         VALUES ('plane', 'project', 'plane', 10)`,
      ),
    ).rejects.toThrow();
    await expect(
      database.pool.query(
        `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km")
         VALUES ('unknown', 'project', 'unknown', 10)`,
      ),
    ).rejects.toThrow();
    await expect(
      database.pool.query(
        `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km")
         VALUES ('legacy-plane-write', 'project', 'plane', 10)`,
      ),
    ).rejects.toThrow();

    const legacyWrite = await database.pool.query(
      `SELECT "transport_emission_profile", "travel_date", "distance_km"
       FROM "project_shared_travel_leg"
       WHERE "id" = 'legacy-write'`,
    );
    expect(legacyWrite.rows).toEqual([
      expect.objectContaining({
        transport_emission_profile: "train",
        distance_km: "42.5",
      }),
    ]);
    const legacyWriteThroughView = await database.pool.query(
      `SELECT "activity_type", "activity_date" FROM "project_activity" WHERE "id" = 'legacy-write'`,
    );
    expect(legacyWriteThroughView.rows).toEqual([
      {
        activity_type: "train",
        activity_date: legacyWrite.rows[0].travel_date,
      },
    ]);

    await database.pool.query(
      `DELETE FROM "project_activity" WHERE "id" = 'legacy-write'`,
    );
    await expect(
      database.pool.query(
        `SELECT "id" FROM "project_shared_travel_leg" WHERE "id" = 'legacy-write'`,
      ),
    ).resolves.toMatchObject({ rows: [] });

    const constraintNames = await database.pool.query(
      `SELECT "conname" FROM "pg_constraint"
       WHERE "conrelid" = 'project_shared_travel_leg'::regclass
       AND "contype" IN ('p', 'f')
       ORDER BY "conname"`,
    );
    expect(constraintNames.rows).toEqual([
      { conname: "project_shared_travel_leg_pkey" },
      { conname: "project_shared_travel_leg_project_id_project_id_fk" },
    ]);

    await database.pool.query(`DELETE FROM "project" WHERE "id" = 'project'`);
    const remainingTravelLegs = await database.pool.query(
      `SELECT "id" FROM "project_shared_travel_leg"`,
    );
    expect(remainingTravelLegs.rows).toEqual([]);
  });

  it.each(["plane", "unknown"])(
    "aborts before conversion when legacy data contains %s",
    async (invalidProfile) => {
      const database = await createDisposableDatabase();
      databases.push(database);
      await applyPriorMigrations(database.pool);
      await createLegacyProject(database.pool);
      await database.pool.query(
        `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km")
         VALUES ('legacy-invalid', 'project', $1, 10)`,
        [invalidProfile],
      );

      await expect(applyCutoverMigration(database.pool)).rejects.toThrow(
        "outside the Project Shared Travel profile set",
      );

      const legacyRows = await database.pool.query(
        `SELECT "id", "activity_type" FROM "project_activity"`,
      );
      expect(legacyRows.rows).toEqual([
        { id: "legacy-invalid", activity_type: invalidProfile },
      ]);
      await expect(
        database.pool.query(`SELECT * FROM "project_shared_travel_leg"`),
      ).rejects.toThrow();
    },
  );
});
