# Live email verification

From the repository root:

```sh
pnpm --filter @greendex/cost-tracker test:email-delivery
```

This focused, uncached check covers **both** applications. It reads each app's
ignored `.env` independently and the shared `packages/database/.env`. Missing or
placeholder credentials, unapproved mailbox settings, and invalid retention
flags fail closed. It never substitutes other SMTP credentials or uses aliases.
All outbound workflow messages target `greendex-testing@apps.sieh.org` only.

The runner creates an ownership-marked isolated database, migrates it, and runs
the canonical seed once. `scripts/managed-app-servers.ts` launches dedicated Next
CLI processes on distinct ephemeral loopback ports, with separate build output
and tsconfig copies. Next still writes app-root `next-env.d.ts`; the helper
snapshots and restores that generated file only if it still matches captured
run output. A concurrent external update is preserved and fails cleanup rather
than being overwritten. It never runs app `dev`/`predev`/`start` scripts, discovers
existing servers, or resets development data. Readiness requires the exact
`X-Greendex-Test-Run` response header from the existing auth endpoint.

Reusable lifecycle contract: `startManagedAppServers(root, {runId, databaseUrl},
appEnvironments)` receives the isolated database helper's handle, returns both
base URLs and an environment map containing `TEST_RUN_ID`,
`CALCULATOR_TEST_BASE_URL`, and `COST_TRACKER_TEST_BASE_URL`. Consumers must use
these URLs without development-server fallbacks, await readiness, and call
`stop()` in `finally` before disposing of the database. Only owned process groups
and per-run output/config files are removed, including on startup failure.

Signup verification, Organization Invitation acceptance, and password reset
are exercised in both apps; Calculator magic-link sign-in and Cost Tracker
Participant Invitation redemption are separate cases. Each case checks a new
IMAP UID boundary, recipient/sender, subject, and current-run account marker or
API-issued invitation identity. Parsed delivered links—not manufactured tokens—
drive HTTP requests and supported APIs. Calculator signup waits for IMAP receipt
after its deferred delivery. Controlled invalid-password SMTP authentication
checks use in-memory copies and never alter real credentials.

Messages are **retained by default**. Explicit opt-in:

```sh
DELETE_TESTMAILS_DURING_TESTRUN=true pnpm --filter @greendex/cost-tracker test:email-delivery
```

Only UIDs proven to belong to successfully correlated workflows can be deleted.
Deletion requires UIDPLUS, rechecks mailbox identity, and verifies disappearance;
the inbox is never cleared. Values other than `true`/`false` are invalid.

Human-readable results and sanitized JSON include the commit, dirty-tree state,
seed source hash/rules version, workflow outcomes, timing, and cleanup results.
Per-run reports live in ignored `.turbo/email-workflows/<run-id>.json`; no message
bodies, cookies, delivered links, tokens, credential values, or raw errors are
persisted. Failed prerequisites explicitly block dependent workflows and yield a
nonzero exit. Cleanup failures fail verification. An abrupt unhandled termination
is not proof of cleanup; recovery requires independently verified run ownership.

Mocked invitation tests remain valuable unit coverage, but are not live-service
acceptance. Calculator's `scripts/send-test-emails.tsx` is a legacy direct-template
preview, not a compliant workflow check.
