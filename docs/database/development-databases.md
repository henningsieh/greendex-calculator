# Development databases

One migration chain, one database per environment. Every migrated database
holds ALL tables (calculator and cost-tracker) because the journal in
`packages/database/src/migrations/` is shared. There are no per-app schemas.

## Rule

Each app keeps its own development database, and each database is seeded on
its own. Same tables everywhere (shared chain), separate rows per app.
Seed every database you use; an empty page usually means that database was
never seeded, not that data is missing.

## Instances (Coolify)

| Public port | Coolify resource | Databases | Purpose | Backups |
| --- | --- | --- | --- | --- |
| `5444` | `greendex-calculator-dev-postgres` (`m0w8…`) | `postgres` | Legacy calculator dev | Daily, 7-day retention |
| `5445` | `postgresql-database-cost-tracker` (`o0de…`) | `calculator_dev`, `costtracker_dev` | Calculator uses `calculator_dev`, cost-tracker uses `costtracker_dev`; seed each one | None — enable before relying on it |
| `5488` | `greendex-dev-postgres` (`a004…`, Live) | managed | Shared development data, private network only | None |

Preview databases are per-PR and isolated: use the private UUID hostname on
port `5432`, never a host IP or public port.

## Connection values

- Shape: `postgres://postgres:<password>@188.245.144.137:<port>/<db>?sslmode=require`
- Passwords live in the Coolify resource's environment records. Retrieve them
  from Coolify; never commit credentials or complete connection strings.
- The `:5444` instance presents a self-signed certificate chain that WSL
  clients reject (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Dev-only workaround for
  one-off scripts: `NODE_TLS_REJECT_UNAUTHORIZED=0`. The apps' `:5445`
  connections verify normally.

## Seeding

- Calculator demo data (owner, org, projects): run the seeder from the app
  whose `.env` points at the target database —
  `pnpm --filter @greendex/calculator run db:seed`. Stop its dev server first.
- Cost-tracker has no seeder. Register accounts through its UI, or copy the
  seed org the same way any row moves between dev databases (documented once,
  never as routine).
- Dropping a dev database means its lived-in rows are gone unless that
  instance has backups (see table). The journal re-migrates schema, never data.

## See also

- [Coolify database connections](./coolify-ssl-connection.md) — deployed connection boundary.
- [Coolify runbook](../agents/instructions/coolify.md) — resources, previews, deployment contract.
