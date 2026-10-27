import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import pg from "pg";

class ResetError extends Error {}

const root = fileURLToPath(new URL("../../../../", import.meta.url));

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0]!)) {
    console.log(
      "Usage: pnpm run db:reset\nIrreversibly erase public and drizzle in greendex_development, then migrate and seed. Stop all database consumers first. No backup. See README.md.",
    );
    return;
  }
  if (args.length)
    throw new ResetError("Unknown arguments. Use pnpm run db:reset --help.");

  const envPath = resolve(root, "packages/database/.env");
  if (existsSync(envPath)) loadEnvFile(envPath);
  if (process.env.NODE_ENV === "production")
    throw new ResetError("Production reset refused.");

  let target;
  try {
    const connectionString = process.env.DATABASE_URL ?? "";
    const url = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "188.245.144.137" ||
      url.port !== "5489" ||
      url.pathname !== "/greendex_development" ||
      connectionString.includes("?") ||
      connectionString.includes("#") ||
      !url.username ||
      !url.password
    )
      throw new Error();
    target = {
      host: url.hostname,
      port: Number(url.port),
      database: url.pathname.slice(1),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      connectionString,
    };
  } catch {
    throw new ResetError(
      "DATABASE_URL must name 188.245.144.137:5489/greendex_development with credentials and no query or fragment.",
    );
  }
  console.log(
    `IRREVERSIBLE: erasing public and drizzle in ${target.database} on ${target.host}:${target.port}, then migrating and seeding.`,
  );

  const client = new pg.Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
  });
  try {
    await client.connect();
    const identity = await client.query("SELECT current_database() AS database");
    if (
      identity.rows.length !== 1 ||
      identity.rows[0]?.database !== target.database
    ) {
      throw new ResetError(
        "Connected database differs from the approved target.",
      );
    }
    await client.query("BEGIN");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("CREATE SCHEMA public AUTHORIZATION CURRENT_USER");
    await client.query("COMMIT");
  } finally {
    // Closing also rolls back an uncommitted transaction on failure.
    await client.end();
  }

  const env = { ...process.env, DATABASE_URL: target.connectionString };
  for (const command of ["db:migrate", "db:seed"]) {
    try {
      execFileSync("pnpm", ["run", command], {
        cwd: root,
        env,
        stdio: "inherit",
      });
    } catch {
      throw new ResetError(
        `${command} failed; the database may be partially reset. Keep consumers stopped and inspect privately before retrying.`,
      );
    }
  }
  console.log("Reset, migration and seed completed.");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof ResetError
      ? error.message
      : "Reset failed; details suppressed to protect credentials. The database may be partially reset. Keep consumers stopped and inspect privately.",
  );
  process.exitCode = 1;
});
