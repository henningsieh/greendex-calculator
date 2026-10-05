---
name: "Drizzle"
description: "Greendex database schemas, generated migrations, and Drizzle ORM/Kit lookup"
applyTo: "packages/database/src/**/*.ts,packages/database/drizzle.config.ts,apps/calculator/src/lib/better-auth/index.ts,packages/database/src/schemas/auth-schema.ts"
---

# Drizzle

## Official documentation

1. Confirm the installed `drizzle-orm` and `drizzle-kit` versions in `packages/database/package.json` and `pnpm-lock.yaml`.
2. Start with the official [Drizzle `llms.txt` index](https://orm.drizzle.team/llms.txt). Use the [full index](https://orm.drizzle.team/llms-full.txt) only when the focused index does not expose the required ORM or Kit page.
3. Fetch only the pages needed for the current change.
4. Compare them with `packages/database/`; local schema, migration history, and installed declarations win.

No official Drizzle project skill is adopted. These official pages and installed declarations are the authorities. The [integration registry](../integrations.md#drizzle-orm-and-kit) is only the aggregate navigation surface.

## Greendex workflow

- Schemas, the client, and migrations are owned by `packages/database/`.
- Edit the owning schema, run `pnpm run db:generate`, inspect the generated SQL and snapshot, then apply only to the intended database with `pnpm run db:migrate`.
- Never hand-edit generated Drizzle snapshots or applied migrations. Never hand-apply migration SQL to a shared database either: an unrecorded apply poisons the journal for every later run (the migrator retries the file, `CREATE` fails, and `drizzle-kit migrate` exits 1 printing nothing — it swallows the real error).
- Use the built-in `drizzle-kit migrate` command, not a custom migration runner. The installed ORM selects pending migrations by the last recorded timestamp; it stores content hashes but does not validate them. If Kit exits silently, diagnose with the ORM migrator without replacing the normal command or modifying history automatically.
- Calculator and Cost Tracker load their own `.env` in their existing `prebuild` hooks before calling root `db:migrate`. Root `db:migrate` delegates only to the database package's original Drizzle command. Both apps currently use the same connected dev database; Documentation has no database dependency.
- Use root `pnpm run dev`: its existing `predev` hook migrates the connected database once before Turbo starts any server. App `predev` hooks and Turbo dependencies do not repeat migrations. Direct app `dev` or bare `turbo run dev` bypass the root gate; migrate manually first when using those entrypoints. Root builds run sequentially with `--concurrency=1`; database-consuming app builds are non-cacheable so their existing `prebuild` hooks run on every deployment. There are no added script names, migration locks or custom runners. Agents must coordinate separate invocations with the owner; do not create lane databases or hand-apply SQL as part of ordinary implementation work.
- Repair rule for a half-applied migration on scratch data only: confirm affected tables hold zero rows that matter, drop the partial objects, delete only the stale journal row, re-run the migrator, verify the final schema. Never mark a divergent schema as applied.
- Better Auth schema changes start with its configuration and `auth:generate`; then use the same inspected Drizzle migration workflow.
- Deployment-time migration and private-network connection rules belong to the [Coolify map](coolify.md) and `AGENTS.md`. Resetting a database is destructive operator work requiring explicit approval; normal lifecycle migration never drops schemas or seeds automatically.
