# Local disposable test fixtures

Run the full unit/integration suites without touching the shared Live or
Preview databases described in [development databases](development-databases.md).
Every fixture here is local, disposable, and owned by one test run. Never point
these commands at a deployed connection string.

## Rules

- Only `127.0.0.1` fixture endpoints. Never select deployed data.
- One app dev server at a time; test suites run serially.
- Storage tests use Garage only, matching the deployed implementation. No
  MinIO, no mocks, no skipped storage coverage.
- Fixture credentials are throwaway values in an untracked local file. Never
  commit them and never reuse deployed secrets.

## 1. Disposable PostgreSQL

Start one owned container with a published loopback port. Trust auth is fine
because the port binds to loopback only and the data is disposable.

```sh
docker run -d --name local-test-postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1:55433:5432 \
  postgres:17
```

Some suites depend on identifier ordering, so keep a second container with a
`C` locale when the default-locale run disagrees:

```sh
docker run -d --name local-test-postgres-c \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_INITDB_ARGS=--locale=C \
  -p 127.0.0.1:55434:5432 \
  postgres:17
```

Create the working database and migrate it with the normal command:

```sh
psql postgresql://postgres@127.0.0.1:55433/postgres -c 'CREATE DATABASE merge_review'
DATABASE_URL=postgresql://postgres@127.0.0.1:55433/merge_review pnpm run db:migrate
```

Tests that need their own database use
`apps/calculator/src/__tests__/helpers/disposable-database.ts`
(`withDisposableDatabase`), which creates a uniquely named database from
`DATABASE_URL` and drops it afterwards, even on failure.

## 2. Disposable Garage S3

Use the official pinned release matching the deployed Garage version (see
[Garage infrastructure](../../apps/cost-tracker/docs/infrastructure/garage.md);
currently `dxflrs/garage:v2.1.0`). Write a local `garage.toml` with a 64-hex
`rpc_secret`, then start the container with that file mounted read-only:

```sh
docker run -d --name local-test-garage \
  -p 127.0.0.1:55900:3900 \
  -v "$PWD/garage.toml:/etc/garage.toml:ro" \
  dxflrs/garage:v2.1.0
docker exec local-test-garage /garage status
docker exec local-test-garage /garage layout assign -z local -c 1G <node-id>
docker exec local-test-garage /garage layout apply --version 1
docker exec local-test-garage /garage bucket create disposable
docker exec local-test-garage /garage key create local-test-key
docker exec local-test-garage /garage bucket allow --read --write --key <key-id> disposable
```

Scope the generated key to the `disposable` bucket only. Keep the key in the
untracked local env file described below.

## 3. Local test environment overrides

Keep an untracked file outside the repository (never in Git) that points every
consumer at the fixtures, with placeholder values for everything else:

```sh
DATABASE_URL=postgresql://postgres@127.0.0.1:55433/merge_review
S3_ENDPOINT=http://127.0.0.1:55900
S3_REGION=garage
S3_BUCKET=disposable
S3_ACCESS_KEY_ID=<local-disposable-key-id>
S3_SECRET_ACCESS_KEY=<local-disposable-secret>
# Placeholder OAuth/mail only; auth/invitation tests mock delivery.
SMTP_HOST=127.0.0.1
SMTP_PORT=587
```

Source it before every server and test command. An injected `DATABASE_URL`
takes precedence over `packages/database/.env`, which is how the shared dev
configuration stays untouched.

## 4. Servers and suites

Start at most one app server, with the fixture overrides applied:

```sh
# From apps/calculator or apps/cost-tracker, with the env file sourced:
pnpm exec dotenv -v NODE_ENV=development \
  -e ../../packages/database/.env -e .env -- next dev --port 3000
```

Run every suite serially with one worker and isolation, so cross-file mocks
cannot leak between test files:

```sh
pnpm --filter @greendex/cost-tracker exec vitest run --maxWorkers=1 --isolate
pnpm --filter @greendex/calculator exec vitest run --maxWorkers=1 --isolate
pnpm --filter @greendex/auth exec vitest run --maxWorkers=1 --isolate
pnpm exec vitest run scripts/check-agent-instructions.policy.test.ts scripts/check-cost-tracker-persistence-seam.test.ts
pnpm exec vitest run packages/email/src/send.test.ts --maxWorkers=1 --isolate
```

Documentation route tests have no workspace runner and are silently omitted by
root Turbo, so run them with an explicit temporary config (rooted at
`apps/documentation`, `@` aliased to its `src`, automatic JSX). Email has no
test script either; the explicit path above covers it.

Playwright browser suites and screenshots are a separate, explicitly approved
exclusion — unit/integration evidence never counts as browser verification.

## 5. Cleanup

Stop and remove only the owned fixture containers, then their data volumes.
Container removal alone leaves the PostgreSQL data volumes behind.

```sh
docker stop local-test-postgres local-test-postgres-c local-test-garage
docker rm local-test-postgres local-test-postgres-c local-test-garage
docker volume ls --format '{{.Name}}'
# Remove ONLY the volumes reported for the containers above.
docker volume rm <fixture-volume> [<fixture-volume>]
```

Confirm nothing remains: `docker ps --filter name=local-test` prints nothing
and the fixture volumes are gone. Deployed databases, Garage objects, and
credentials are never part of cleanup.
