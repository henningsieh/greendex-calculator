# Development databases

Use a database whose migration history matches the checkout that connects to it.
Main and the Cost Tracker branch currently have different migration chains.
Separate database names do not guarantee compatible schemas.

## Rule

Each app keeps its own development database, and each database is seeded on
its own. Apply migrations from the consuming checkout, not another branch.
Do not point main at a database migrated by the Cost Tracker branch: its host
assignment migration removes `project.responsible_user_id`, which main needs.
Seed every database you use; an empty page usually means that database was
never seeded, not that data is missing.

## Instances (Coolify)

| Public port | Coolify resource | Databases | Purpose | Backups |
| --- | --- | --- | --- | --- |
| `5444` | `greendex-calculator-dev-postgres` (`m0w8…`) | `calculator_main_dev`, `postgres` | Main Calculator uses `calculator_main_dev`; `postgres` is preserved spare data with the Cost Tracker schema | Daily, 7-day retention; confirm new database coverage in backup configuration |
| `5445` | `postgresql-database-cost-tracker` (`o0de…`) | `calculator_dev`, `costtracker_dev` | Cost branch Calculator uses `calculator_dev`, Cost Tracker uses `costtracker_dev`; neither is schema-compatible with main | Daily since this change was made |
| `5488` | `greendex-dev-postgres` (`a004…`, Live) | managed | Shared development data, private network only | None |

## Which checkout uses which database

- Main checkout (`greendex-calculator`, `main` or a branch at the same schema): calculator → `:5444/calculator_main_dev`.
- Cost worktree (`greendex-cost-tracker`, `chore/add-cost-tracker-app`): calculator → `:5445/calculator_dev`, cost-tracker → `:5445/costtracker_dev`.
- Any other checkout without its own `.env` uses whichever `DATABASE_URL` it is given; there is no automatic routing. When a page looks wrongly empty, check the checkout's `.env` first.

`calculator_main_dev` was created from main's migrations `0000`–`0016` and
seeded with the Calculator seeder. The existing `postgres`, `calculator_dev`,
and `costtracker_dev` databases were not reset or modified during this repair.
Tests use Calculator's `.env`; there is no separate automatic test database.
After changing `.env`, restart any already-running process that inherited
`DATABASE_URL` from its launcher. Changing the file does not change that process's
environment or existing database pool.

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
- Test and agent lanes must drop the databases they create (`lane_*`,
  `shared_travel_*`, `cleanup_*`, …) when finished. Twenty stale lane
  databases were swept in one cleanup; do not let them accumulate again.

## See also

- [Coolify database connections](./coolify-ssl-connection.md) — deployed connection boundary.
- [Coolify runbook](../agents/instructions/coolify.md) — resources, previews, deployment contract.
