/**
 * Historical migration exception (#270): run-owned disposable empty database.
 * Exempt from the canonical seed rule; validates the disposable target and
 * drops only the created database during cleanup. Preserves upgrade assertions.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, it } from "vitest";

import { withDisposableDatabase } from "@/__tests__/helpers/disposable-database";

const migrations = resolve(
  import.meta.dirname,
  "../../../../packages/database/src/migrations",
);

it("backfills host assignments before dropping the legacy project column", async () => {
  await withDisposableDatabase("host_assignment", async (pool) => {
    const filenames = (await readdir(migrations))
      .filter((file) => /^\d{4}_.*\.sql$/.test(file))
      .sort();
    for (const filename of filenames.filter(
      (file) => Number(file.slice(0, 4)) <= 28,
    )) {
      await pool.query(await readFile(resolve(migrations, filename), "utf8"));
    }
    await pool.query(`
      INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
      VALUES ('host', 'Host', 'host@example.com', true, now(), now());
      INSERT INTO "organization" (id, name, slug, country, created_at)
      VALUES ('org', 'Organization', 'org', 'LV', now());
      INSERT INTO "project" (id, name, start_date, end_date, location, country, responsible_user_id, organization_id)
      VALUES ('project', 'Project', now(), now(), 'Riga', 'LV', 'host', 'org');
    `);
    await pool.query(
      await readFile(resolve(migrations, "0029_brief_pepper_potts.sql"), "utf8"),
    );
    const assignment = await pool.query(
      `SELECT project_id, user_id FROM host_project_assignment WHERE project_id = 'project'`,
    );
    expect(assignment.rows).toEqual([{ project_id: "project", user_id: "host" }]);
    const columns = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'project' AND column_name = 'responsible_user_id'`,
    );
    expect(columns.rows).toEqual([]);
  });
});
