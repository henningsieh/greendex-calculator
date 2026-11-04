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
- Never hand-edit generated Drizzle snapshots or applied migrations. Apply migrations through the repository's migration command so schema changes and the migration journal stay consistent.
- Use the built-in Drizzle migrator. Diagnose failures before changing migration history; never mark a divergent schema as applied.
- Lifecycle hooks, environment loading, and build caching are defined in the current package scripts and Turbo configuration. Inspect those sources before operations; a build or cache hit does not prove that migrations ran. Coordinate operations against shared databases with the operator.
- Better Auth schema changes start with its configuration and `auth:generate`; then use the same inspected Drizzle migration workflow.
- Deployment-time migration and private-network connection rules belong to the [Coolify map](coolify.md) and `AGENTS.md`. Resetting a database is destructive operator work requiring explicit approval; normal lifecycle migration never drops schemas or seeds automatically.
