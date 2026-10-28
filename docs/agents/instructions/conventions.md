---
name: "Repository Conventions"
description: "pnpm, ESM, environment, quality, and repository configuration conventions"
applyTo: "package.json,apps/*/package.json,packages/*/package.json,pnpm-workspace.yaml,turbo.json,.node-version,apps/*/.env.example,.oxfmtrc.json,.oxlintrc.json,**/*.config.ts,**/*.config.mjs"
---

# Repository Conventions

Use this instruction for manifests, configuration, scripts, environment setup, and repository workflow.

## Package manager and runtime

- Use pnpm for installs and scripts. The root `packageManager` field pins the expected pnpm version.
- Node.js 22 or newer is required; `.node-version` and `engines.node` are authoritative.
- Commit `pnpm-lock.yaml` whenever dependency resolution changes.
- Workspace modules use ESM. Follow each package's `type` field and use `import`/`export`.

Read [workspace instructions](workspace.md) before modifying dependencies, package manifests, `pnpm-workspace.yaml`, or `turbo.json`.

Keep the root `.oxlintrc.json` `jsPlugins` entry and the root `@shadcn/lint` devDependency in sync: the plugin version resolves from the root manifest, so a version bump belongs there and not in the app manifests.

## Environment

- Each application owns its app-specific environment file, created from its `.env.example`. Configure local `DATABASE_URL` once in `packages/database/.env`; Calculator and Cost Tracker load that shared file first. Injected platform values take precedence.
- The calculator validates environment variables in `apps/calculator/src/env.ts`.
- Keep secrets in local or platform-managed configuration; commit only documented placeholders.
- Turbo's `build` and `start` tasks require `"env": ["*"]` so injected variables reach workspace processes.

## Oxc documentation and quality commands

For Oxlint or Oxfmt behavior, start with the official [Oxc `llms.txt` index](https://oxc.rs/llms.txt), fetch only the relevant tool page, and compare it with `.oxlintrc.json`, `.oxfmtrc.json`, and the installed versions. Oxc migration-only skills are not routine linting or formatting guidance.

Select checks with [the two verification loops](#two-verification-loops). Run commands from the repository root unless the selected check requires an explicit workspace.

The staged-file pre-commit workflow and its design rationale are documented in
the [Husky pre-commit research](../research/husky-pre-commit.md).

- Oxfmt configuration, import sorting, and Tailwind sorting live in `.oxfmtrc.json`.
- Oxlint configuration lives in `.oxlintrc.json`; lint scripts may apply fixes.
- The root `.oxlintrc.json` also loads the `@shadcn/lint` Oxlint JS plugin (declared as a root devDependency) and carries the design-system rules; because workspaces resolve that single config, every workspace lint run includes them. `pnpm run lint:design-system` is the focused check-only pass, fanning out to each app's own `lint:design-system` script. Read [UI components](shadcn.md) before changing those rules.
- `ignorePatterns` and `overrides` entries are resolved relative to the config file directory, so keep them repository-root-relative.
- Tailwind-resolving lint rules run in the apps, auth, and email packages that ship class strings. Config, database, and i18n ship no Tailwind class strings and retain the scoped override. Oxlint overrides do not support `comment` keys; keep rationale here, not in configuration fields.
- Use Vitest for unit/integration tests and Playwright for browser flows.
- Follow the process restrictions in `AGENTS.md`; repository configuration does not override them.

## Two verification loops

This section owns test selection and final verification policy. Follow it during implementation and final acceptance.

### Focused implementation

- Select the smallest meaningful checks for changed behavior and affected integration boundaries. Record the selection rationale. Expand coverage for shared auth, schema, router, SSR, or persistence changes.
- Keep pure unit/component checks server-free. Use focused `pnpm --dir <workspace> exec vitest run <file>` or `pnpm --dir <app> exec playwright test --config=<config> <file> --workers=1 --retries=0` when narrowing a suite.
- Runtime-dependent checks use existing loopback applications and the shared development database. Inspect Next MCP routes, errors, and compilation diagnostics when using an existing dev server, plus real browser observations before and after app changes.
- Existing-server checks accept dev or production servers without an attestation flag. They do not establish production provenance. Dev results do not prove production behavior. The operator owns build/start and final production verification against the reviewed candidate.
- Test runners never build, start servers, migrate, provision databases or stop existing processes. A run may seed the shared development database, because tests need canonical data. It may not delete rows outside the seed while running. Production and staging are excluded. Missing servers or credentials fail rather than skip. The only database target is `greendex_development` at `188.245.144.137:5489`, loaded from shared `packages/database/.env`; each app loads its own configuration automatically. Injected values retain precedence but must satisfy the same target restriction.

Representative focused selections:

| Changed behavior | Focused selection and rationale |
| --- | --- |
| Pure organization role rule | `pnpm --dir packages/auth exec vitest run src/organization-roles.test.ts`. No server is needed. |
| Browser/session setup | Against existing apps, use `pnpm --dir apps/cost-tracker exec playwright test --config=playwright.config.ts hosting-setup.spec.ts --workers=1 --retries=0`. Verify original-session success before reload or reauthentication. |
| Shared auth/schema/router | Expand to affected role/permission units, both apps' auth/procedure integrations, SSR routing, persistence, and cross-app session journeys. |

### Centrally owned final acceptance

The root owns exactly four test commands. Workspace test scripts and aliases are absent.

- `pnpm run test:unit` runs the established server-free package/app selection with two workers, plus repository policy/tooling and Documentation tests.
- `pnpm run test:integration` runs the classifier-complement database/procedure tests, database connection and real OpenAPI HTTP checks, full real-mail workflows, and development Garage checks. Files and shared fixtures run serially. Migration/reset/lifecycle tests that provision additional databases are removed; the canonical development seed implementation remains outside test execution.
- `pnpm run test:e2e` runs both ordinary Playwright suites and the cross-app merge suite against existing apps, with one worker and zero retries. The extra-build-only instant suite is removed.
- `pnpm run test:full` runs unit, integration and e2e sequentially and exits nonzero if any mode fails. Console summaries include sanitized timings. Implementing the command alone does not prove acceptance.

The browser inventory is:

- Cost Tracker, `apps/cost-tracker/playwright.config.ts`.
- Calculator, `apps/calculator/playwright.config.ts`.
- Cross-app merge, `apps/calculator/playwright.merge.config.ts`.

One coordinator owns final acceptance after all writers finish. Reviewers and implementers do not launch competing full runs. The operator owns starting the reviewed production builds, including the required socket service, and making the existing seed fixtures available. Runners borrow these resources and never dispose of them.

For final verification:

1. Preserve dedicated-mailbox/current-run correlation, default mail retention, development Garage isolation, owned-object cleanup, and sanitized evidence. Missing services or credentials are blockers. Remove only run-owned rows, sessions and storage objects; never clear shared fixtures or mailboxes. Browser artifacts remain private, with trace, video and automatic screenshots off.
2. Require independent Standards and Spec reviews of the same integration candidate. Resolve findings with bounded focused repairs and review the changed final diff again.
3. Require zero flaky final acceptance. Use zero retries. Report failures, blocks, skips and cleanup failures honestly; none prove a passed gate. A nonzero subprocess or real-workflow failure fails its mode; full still attempts the remaining modes.
4. Record the exact candidate, runtime targets, selected suites, results, timings, and blockers without secrets. Source/build-affecting changes invalidate relevant evidence. No fixed count of repeated green full runs is required.
5. Retain final `pnpm run format`, `pnpm run lint` including design-system checks, applicable `pnpm run type-check`, affected SSR regressions, persistence checks, instruction-policy checks and diff review. Account for overlap without omitting a gate. Honor explicit user restrictions on command execution and report unrun gates rather than inventing evidence.

### Suite evidence runner

`scripts/suite-evidence.py` runs one full suite per invocation and keeps a receipt that binds the run to the candidate. The suites themselves remain the root commands above; the runner only supplies the receipt, the live log and the exit receipt.

```bash
./scripts/suite-evidence.py run unit
./scripts/suite-evidence.py run integration
./scripts/suite-evidence.py run e2e
./scripts/suite-evidence.py create-report
```

- `run <suite>` captures `<suite>.before.json` and `<suite>.before.build-files.sha256` first, then runs exactly `pnpm run test:<suite>` with no added flags, streams output live to `<suite>.log`, and writes `exit=<code>` to `<suite>.exit`. It deletes that suite's previous four files, so a re-run overwrites one attempt.
- `create-report` runs nothing. It seals the three suites into `handover/<commit>/` with the logs, exit receipts, before-receipts, build manifest, `evidence.json`, `HANDOVER.md` and `SHA256SUMS`. A re-run replaces that directory. Any suite exit other than 0 makes it `FAIL` and exits nonzero; a receipt that no longer matches the current observation is reported as a named delta under `PASS_WITH_NOTES` instead of aborting.
- The audit directory defaults to `.audit/<issue from the branch name>`; `--dir` or `--issue` override it. `.audit/` is gitignored, so evidence stays local.
- `--dry-run` prints the plan, `--no-capture` runs a suite without a receipt (no report is possible), and `--keep-going` lets `run all` continue after a failure.
- The before-suite receipt needs both production builds and the production listeners on ports 3000, 3002 and 4000; a development server is refused. Runtime route-cache files under `.next/server/route-cache` are excluded from the build manifest because the running server writes them.
- Evidence invalidates when the candidate moves. Capture all three suites after the final build and commit for a plain `PASS`; later source changes appear as deltas.

## Database changes

Schemas and migrations live in `packages/database/src/`.

1. Edit the appropriate schema under `packages/database/src/schemas/`.
2. Run `pnpm run db:generate`.
3. Inspect the generated SQL and snapshot.
4. Apply with `pnpm run db:migrate` only against the intended database.

Better Auth schema generation uses the calculator's `auth:generate` script and writes to `packages/database/src/schemas/auth-schema.ts`.

## Generated and centralized files

- Shared dependency versions belong in the catalog in `pnpm-workspace.yaml`.
- Do not hand-edit generated Drizzle snapshots.
- Do not hand-edit Coolify-generated compose files.
- Next.js agent documentation inside `AGENTS.md` is generated by the Next codemod; preserve its marker block.

## Git

- Keep commits focused and use descriptive conventional-style messages.
- Review `git diff` and `git status` before committing.
- Never bypass the pre-commit hook with `HUSKY=0` or `git commit --no-verify`. If the hook fails, fix the reported issue and commit again.
- Include tests and documentation when behavior or an operational invariant changes.
