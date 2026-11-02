# Existing test fixtures

Test commands use existing configuration and resources. See the
[two-loop policy](../agents/instructions/conventions.md#two-verification-loops).

Unit/component and repository-policy checks need no running server. Integration
checks use only `greendex_development` at `188.245.144.137:5489`, configured in
`packages/database/.env`, plus each app's ignored `.env`. Both apps must observe
the same existing seed identities. Tests never provision, migrate, seed or start
services. Missing servers, fixtures or credentials fail rather than skip.

Root E2E checks require both existing loopback applications and the Calculator
socket service. Dev or production servers are accepted without a flag. The
runner makes no production-provenance claim; the user owns final verification
against the reviewed production builds.

Real mail uses the correlated dedicated mailbox and retains messages. Garage
uses the existing development bucket and unique run-owned keys. Shared fixture
users are never globally cleared. Cleanup removes only rows, sessions and
objects created by the current run. Existing servers and databases are retained.

Run `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run test:e2e` or
`pnpm run test:full` from the repository root for repository-wide coverage.

From `apps/cost-tracker`, run `pnpm run test:unit`, `pnpm run test:integration`,
or `pnpm run test:e2e` for Cost Tracker-only coverage. Only Cost Tracker must be
running for its integration and E2E commands. Its unit tests need no server.
The app commands load the same configuration and print the same result summaries
as the root commands. Separate live-mail and Garage checks use the root integration command.

For individual files, use workspace `pnpm exec vitest run <file>` or
`pnpm exec playwright test --config=<config> <file>` with the same configuration.
