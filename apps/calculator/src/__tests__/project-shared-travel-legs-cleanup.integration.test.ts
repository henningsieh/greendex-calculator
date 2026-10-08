import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { afterEach, describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
  import.meta.dirname,
  "../../../../packages/database/src/migrations",
);
const priorMigrationPrefix = "0012_";
const cleanupMigrationPrefix = "0013_";

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

async function applyMigrationsUpTo(pool: Pool, maxPrefix: string): Promise<void> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .filter((filename) => filename <= `${maxPrefix}\uffff`)
    .sort();

  for (const filename of filenames) {
    const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
    await pool.query(sql);
  }
}

async function applyCleanupMigration(pool: Pool): Promise<void> {
  const filenames = await readdir(migrationsDirectory);
  const filename = filenames.find((entry) =>
    entry.startsWith(cleanupMigrationPrefix),
  );
  if (!filename) {
    throw new Error("Cleanup migration 0013 is missing");
  }
  const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function createCanonicalProject(pool: Pool): Promise<void> {
  await pool.query(`
    INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
    VALUES ('owner', 'Cleanup Organization Administrator', 'organization-administrator@example.com', true, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    INSERT INTO "organization" ("id", "name", "slug", "created_at")
    VALUES ('organization', 'Cleanup Organization', 'cleanup-organization', '2026-01-01T00:00:00.000Z');
    INSERT INTO "project" ("id", "name", "start_date", "end_date", "location", "country", "responsible_user_id", "organization_id", "archived", "created_at", "updated_at")
    VALUES ('project', 'Cleanup Project', '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 'Berlin', 'DE', 'owner', 'organization', false, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  `);
}

async function createDisposableDatabase(): Promise<{
  databaseName: string;
  adminPool: Pool;
  pool: Pool;
}> {
  const databaseName = `cleanup_${randomUUID().replaceAll("-", "")}`;
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

describe("Project Shared Travel Leg compatibility cleanup", () => {
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

  it("drops the legacy view/trigger/function and keeps canonical storage operational", async () => {
    const database = await createDisposableDatabase();
    databases.push(database);

    await applyMigrationsUpTo(database.pool, priorMigrationPrefix);
    await createCanonicalProject(database.pool);

    // Seed canonical rows before cleanup — these must survive the drop.
    await database.pool.query(
      `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km", "description", "travel_date")
       VALUES ('leg-boat', 'project', 'boat', 10.5, 'Boat transfer', '2026-02-01T00:00:00.000Z')`,
    );
    await database.pool.query(
      `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km", "description", "travel_date")
       VALUES ('leg-car', 'project', 'car', 20, null, null)`,
    );

    // Pre-cleanup: compatibility layer must still exist.
    const viewBefore = await database.pool.query(
      `SELECT to_regclass('project_activity') AS view_reg`,
    );
    expect(viewBefore.rows[0].view_reg).toBe("project_activity");

    const triggerBefore = await database.pool.query(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'project_activity_compatibility_view_write'`,
    );
    expect(triggerBefore.rows).toHaveLength(1);

    const functionBefore = await database.pool.query(
      `SELECT proname FROM pg_proc WHERE proname = 'project_activity_compatibility_view_write'`,
    );
    expect(functionBefore.rows).toHaveLength(1);

    // Legacy write must succeed before cleanup (proves view was operational).
    await database.pool.query(
      `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km")
       VALUES ('legacy-pre', 'project', 'train', 30)`,
    );
    const legacyPre = await database.pool.query(
      `SELECT transport_emission_profile FROM "project_shared_travel_leg" WHERE id = 'legacy-pre'`,
    );
    expect(legacyPre.rows[0].transport_emission_profile).toBe("train");

    await applyCleanupMigration(database.pool);

    // Post-cleanup: view/trigger/function must be gone.
    const viewAfter = await database.pool.query(
      `SELECT to_regclass('project_activity') AS view_reg`,
    );
    expect(viewAfter.rows[0].view_reg).toBeNull();

    const triggerAfter = await database.pool.query(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'project_activity_compatibility_view_write'`,
    );
    expect(triggerAfter.rows).toHaveLength(0);

    const functionAfter = await database.pool.query(
      `SELECT proname FROM pg_proc WHERE proname = 'project_activity_compatibility_view_write'`,
    );
    expect(functionAfter.rows).toHaveLength(0);

    // Querying the legacy view must now fail.
    await expect(
      database.pool.query(`SELECT * FROM "project_activity"`),
    ).rejects.toThrow();
    await expect(
      database.pool.query(
        `INSERT INTO "project_activity" ("id", "project_id", "activity_type", "distance_km") VALUES ('legacy-post', 'project', 'bus', 10)`,
      ),
    ).rejects.toThrow();

    // Canonical rows must be preserved.
    const preserved = await database.pool.query(
      `SELECT id, transport_emission_profile, distance_km FROM "project_shared_travel_leg" ORDER BY id`,
    );
    expect(preserved.rows).toEqual([
      { id: "leg-boat", transport_emission_profile: "boat", distance_km: "10.5" },
      { id: "leg-car", transport_emission_profile: "car", distance_km: "20.0" },
      {
        id: "legacy-pre",
        transport_emission_profile: "train",
        distance_km: "30.0",
      },
    ]);

    // Canonical storage must remain fully operational for CRUD + enum enforcement.
    await database.pool.query(
      `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km", "description", "travel_date")
       VALUES ('leg-ecar', 'project', 'electricCar', 42.5, 'EV leg', '2026-05-12T00:00:00.000Z')`,
    );
    const ecar = await database.pool.query(
      `SELECT transport_emission_profile, distance_km FROM "project_shared_travel_leg" WHERE id = 'leg-ecar'`,
    );
    expect(ecar.rows[0]).toEqual({
      transport_emission_profile: "electricCar",
      distance_km: "42.5",
    });

    await database.pool.query(
      `UPDATE "project_shared_travel_leg" SET "transport_emission_profile" = 'bus', "distance_km" = 44.1 WHERE id = 'leg-ecar'`,
    );
    const updated = await database.pool.query(
      `SELECT transport_emission_profile, distance_km FROM "project_shared_travel_leg" WHERE id = 'leg-ecar'`,
    );
    expect(updated.rows[0].transport_emission_profile).toBe("bus");

    await database.pool.query(
      `DELETE FROM "project_shared_travel_leg" WHERE id = 'leg-ecar'`,
    );
    const deleted = await database.pool.query(
      `SELECT id FROM "project_shared_travel_leg" WHERE id = 'leg-ecar'`,
    );
    expect(deleted.rows).toHaveLength(0);

    // Enum must still reject unsupported profiles.
    await expect(
      database.pool.query(
        `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km") VALUES ('bad-plane', 'project', 'plane', 10)`,
      ),
    ).rejects.toThrow();
    await expect(
      database.pool.query(
        `INSERT INTO "project_shared_travel_leg" ("id", "project_id", "transport_emission_profile", "distance_km") VALUES ('bad-unknown', 'project', 'unknown', 10)`,
      ),
    ).rejects.toThrow();

    // Enum and canonical constraints must be untouched.
    const enums = await database.pool.query(
      `SELECT typname FROM pg_type WHERE typname = 'project_shared_transport_emission_profile'`,
    );
    expect(enums.rows).toHaveLength(1);

    const enumValues = await database.pool.query(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'project_shared_transport_emission_profile'::regtype ORDER BY enumsortorder`,
    );
    expect(enumValues.rows.map((row) => row.enumlabel)).toEqual([
      "boat",
      "bus",
      "train",
      "car",
      "electricCar",
    ]);

    const constraints = await database.pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'project_shared_travel_leg'::regclass AND contype IN ('p', 'f') ORDER BY conname`,
    );
    expect(constraints.rows).toEqual([
      { conname: "project_shared_travel_leg_pkey" },
      { conname: "project_shared_travel_leg_project_id_project_id_fk" },
    ]);

    // Cascade still intact
    await database.pool.query(`DELETE FROM "project" WHERE id = 'project'`);
    const remaining = await database.pool.query(
      `SELECT id FROM "project_shared_travel_leg"`,
    );
    expect(remaining.rows).toHaveLength(0);
  });
});
