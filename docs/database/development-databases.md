# Shared development database

Calculator and Cost Tracker use the same PostgreSQL database and migration chain.
Organization, Project, Project Participation and Participant Journey IDs identify
one shared set of rows; there is no copying or synchronization between apps.

## Managed resources

The Greendex `development` environment owns exactly two PostgreSQL resources:

| Role | Coolify resource | Connection |
| --- | --- | --- |
| Live | `greendex-dev-postgres` (`a004oogs4cwss04cok0wwckk`) | Private resource hostname on `5432`; local access via the server on `5488` |
| Preview | `greendex-preview-postgres` (`gcmwapuqoz45mjvtdwl3vgg4`) | Private resource hostname on `5432` |

Both apps must use Live for development and the same Preview resource for preview
deployments. Preview is separate from Live, not a separate database per app or PR.
Production resources are outside this setup and must not be changed.
Garage S3 remains unchanged.

## One local connection configuration

Copy `packages/database/.env.example` to `packages/database/.env` and set
`DATABASE_URL` using the shared Live resource's current credentials from Coolify.
Do not define `DATABASE_URL` in either app's `.env`; those files contain only
app-specific configuration. Never commit credentials or complete connection strings.

Calculator and Cost Tracker lifecycle, seed and Playwright scripts load the shared
file before their app-local file. Vitest setup and Drizzle Kit use the same shared
file. An already injected `DATABASE_URL` takes precedence, so Coolify and one-off
Preview migration commands select the intended shared resource without local forks.
Documentation remains database-free. Use package scripts instead of invoking
`next` directly, which bypasses the shared environment loader.

Restart existing app processes after changing the shared configuration: an existing
pool retains its old connection. The managed resources currently have SSL disabled;
do not add old SSL parameters or disable certificate verification globally.

## Migrations and seed data

Run `pnpm run db:migrate` from the repository root. Both apps use the migrations
in `packages/database/src/migrations`; never apply another branch's chain.

Run root `pnpm run db:seed` (the Calculator seeder) once against shared Live,
with local app servers stopped. Cost Tracker's seed command invokes the same seeder
against the same database; do not run both concurrently. Seeds and migrations are
separate operations: migrations do not insert demo data or reset existing rows.
Destructive cleanup of mock data requires explicit owner authorization.

## See also

- [Database connections](./coolify-ssl-connection.md) — deployed connection boundary.
- [Coolify runbook](../agents/instructions/coolify.md) — deployment operations.
- [Drizzle instructions](../agents/instructions/drizzle.md) — migration workflow.
