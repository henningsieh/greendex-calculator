# Existing test fixtures

The four root test commands use existing configuration and resources. See the
[two-loop policy](../agents/instructions/conventions.md#two-verification-loops).

Unit/component and repository-policy checks need no running server. Integration
checks use only `greendex_development` at `188.245.144.137:5489`, configured in
`packages/database/.env`, plus each app's ignored `.env`. Both apps must observe
the same existing seed identities. Tests never provision, migrate, seed or start
services. Missing servers, fixtures or credentials fail rather than skip.

Browser checks require both existing loopback applications and the Calculator
socket service. Dev or production servers are accepted without a flag. The
runner makes no production-provenance claim; the user owns final verification
against the reviewed production builds.

Real mail uses the correlated dedicated mailbox and retains messages. Garage
uses the existing development bucket and unique run-owned keys. Shared fixture
users are never globally cleared. Cleanup removes only rows, sessions and
objects created by the current run. Existing servers and databases are retained.

Run `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run test:e2e` or
`pnpm run test:full` from the repository root. For focused coverage use workspace
`pnpm exec vitest run <file>` or `pnpm exec playwright test --config=<config> <file>`
with the same configuration. Provisioning migration/seed/lifecycle tests and the
extra-build-only instant suite are removed. Development still owns the
canonical seed implementation; test execution never invokes it.
