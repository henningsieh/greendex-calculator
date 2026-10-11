import { randomUUID } from "node:crypto";

import { Pool } from "pg";

/** Creates only a uniquely named fixture database, never resets the selected app database. */
export async function withDisposableDatabase(
  prefix: string,
  run: (pool: Pool, databaseUrl: string) => Promise<void>,
): Promise<void> {
  if (!/^[a-z_]+$/.test(prefix))
    throw new Error("Invalid fixture database prefix");
  const name = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/postgres";
  const admin = new Pool({ connectionString: url.toString(), max: 1 });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString(), max: 1 });
    try {
      await run(pool, url.toString());
    } finally {
      await pool.end();
    }
  } finally {
    try {
      if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}
