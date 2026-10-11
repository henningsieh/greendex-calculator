import { randomUUID } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { Pool } from "pg";
import { expect, it } from "vitest";

const migrations = resolve(
  import.meta.dirname,
  "../../../../packages/database/src/migrations",
);

it("appends coordinator only to assignment-holding admins and preserves every other role", async () => {
  const name = `coordinator_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString(), max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    const coordinatorDirs: string[] = [];
    for (const entry of (await readdir(migrations)).sort()) {
      if ((await stat(resolve(migrations, entry))).isDirectory()) {
        coordinatorDirs.push(entry);
      }
    }
    for (const dir of coordinatorDirs.slice(0, 27)) {
      await pool.query(
        await readFile(resolve(migrations, dir, "migration.sql"), "utf8"),
      );
    }
    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      SELECT id, id, id || '@example.com', true, now(), now()
      FROM unnest(ARRAY['host-admin','partner-admin','plain-admin','owner-admin','member-assigned','member-plain','already']) AS id;
      INSERT INTO "organization" (id, name, slug, country, created_at)
      VALUES ('host','Host','host','LV',now()), ('partner','Partner','partner','LV',now());
      INSERT INTO "member" (id, organization_id, user_id, role, created_at)
      VALUES ('h','host','host-admin','admin',now()),
        ('p','partner','partner-admin','admin',now()),
        ('a','host','plain-admin','admin',now()),
        ('o','host','owner-admin','owner,admin',now()),
        ('m','host','member-assigned','member',now()),
        ('n','partner','member-plain','member',now()),
        ('e','host','already','admin,project-coordinator',now());
      INSERT INTO "project" (id, name, start_date, end_date, location, country, responsible_user_id, organization_id)
      VALUES ('assigned','Assigned',now(),now(),'Riga','LV','host-admin','host'),
        ('other','Other',now(),now(),'Riga','LV','member-assigned','host'),
        ('owned','Owned',now(),now(),'Riga','LV','owner-admin','host'),
        ('prior','Prior',now(),now(),'Riga','LV','already','host');
      INSERT INTO "project_partner_organization" (id, project_id, organization_id)
      VALUES ('partnership','assigned','partner');
      INSERT INTO "partner_coordinator_assignment" (partnership_id, user_id)
      VALUES ('partnership','partner-admin');
    `);
    const sql = await readFile(
      resolve(migrations, coordinatorDirs[27], "migration.sql"),
      "utf8",
    );
    await pool.query(sql);
    await pool.query(sql);
    const result = await pool.query('SELECT id, role FROM "member" ORDER BY id');
    expect(result.rows).toEqual([
      { id: "a", role: "admin" },
      { id: "e", role: "admin,project-coordinator" },
      { id: "h", role: "admin,project-coordinator" },
      { id: "m", role: "member,project-coordinator" },
      { id: "n", role: "member" },
      { id: "o", role: "owner,admin,project-coordinator" },
      { id: "p", role: "admin,project-coordinator" },
    ]);
  } finally {
    await pool.end();
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
      [name],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  }
});
