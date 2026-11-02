# Cost Tracker

A Next.js application for tracking and understanding costs.

## Local setup

1. Copy `.env.example` to `.env`.
2. Run the workspace development command from the repository root: `pnpm dev`.

The app uses the shadcn preset `b3adko9VFA`. Add shadcn components from this application directory with `pnpm dlx shadcn@latest add <component>`.

## Tests

Run from `apps/cost-tracker`:

```bash
pnpm run test:unit
pnpm run test:integration
pnpm run test:e2e
```

These commands run only Cost Tracker tests. Unit tests need no server. Integration and E2E tests require the existing Cost Tracker server and shared development database. Keep the server running. Configuration loads from `.env` and `../../packages/database/.env`.

Unit tests use two workers. Integration and E2E tests use one worker. All commands report the suite result, duration, candidate commit, branch, working-tree state, and overall exit code.

Run repository-wide suites from the repository root. The root integration suite also checks live mail and Garage. See the [test instructions](../../docs/agents/instructions/conventions.md#two-verification-loops).
