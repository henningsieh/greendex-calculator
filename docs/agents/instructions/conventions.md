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
- The root `.oxlintrc.json` also loads the `@shadcn/lint` Oxlint JS plugin (declared as a root devDependency) and carries the design-system rules; because workspaces resolve that single config, every workspace lint run includes them, so the root `lint` chain needs no separate design-system pass and scans those sources once. `pnpm run lint:design-system` is merely another entrypoint to that same required pass: it fans out sequentially to each app's own check-only `oxlint src` script (no `--fix`, no `-A`/`-D` flags), enforcing exactly the same shared policy scoped per app. Staged-file pre-commit lint uses the same config, so staged changes get the identical policy. Read [UI components](shadcn.md) before changing those rules.
- `ignorePatterns` and `overrides` entries are resolved relative to the config file directory, so keep them repository-root-relative.
- Tailwind-resolving lint rules live in `oxlint.tailwind.json` and run through `pnpm run check:tailwind`, which the root `lint` chain calls. They stay out of `.oxlintrc.json` on purpose: the `eslint-plugin-better-tailwindcss` plugin builds a Tailwind design system when it loads, which costs tens of seconds on this machine, so keeping it in the shared config made every editor save and every workspace lint run pay that price. The scope is production JSX/TSX sources in the apps, auth, and email packages, excluding tests and stories, enforced by `scripts/oxlint-tailwind-scope.test.ts`; when adding class-bearing sources, update that config and the scope test together. `better-tailwindcss/no-conflicting-classes` stays disabled because its canonical collapse is exponential ([tailwindlabs/tailwindcss#20557](https://github.com/tailwindlabs/tailwindcss/issues/20557)) and could take minutes per file. Oxlint overrides do not support `comment` keys; keep rationale here, not in configuration fields.
- Cost Tracker UI copy is enforced by `greendex/no-hardcoded-ui-copy` in `scripts/oxlint-i18n.mjs`. Regular lint and staged-file pre-commit lint share `.oxlintrc.json`. The rule checks static JSX text and visible attributes, including rendered branches; it does not trace values through variables or function calls. Its regression tests run in `test:unit`, not in the lint chain.
- Domain-structure rules live in `scripts/oxlint-domain.mjs`. `greendex-domain/validation-schema-location` reports an error when a component builds a Zod schema instead of importing its feature's `validation-schemas.ts` module; it is scoped to component paths in `.oxlintrc.json` and reports once per schema expression.
- `greendex-domain/schema-derived-identifier` reports when a `validation-schemas.ts` module declares an `id` or `*Id` field, or a standalone `*IdSchema` constant, with a new Zod scalar schema instead of reusing a derived `<X>IdSchema` or `createSelectSchema(table).shape.<column>`. It is an error in Cost Tracker schema modules and a warning in Calculator and package schema modules; identifier policy belongs in the owning schema module rather than a separate helper file.
- `greendex-domain/procedure-input-schema` reports an error when a feature procedure declares its input inline (`.input(z.object(...))` or a chained builder) instead of importing a schema from the owning feature's `validation-schemas.ts`. It is scoped to `procedures.ts` and `procedures/**` modules and reports on the schema expression; output schemas are not covered, since `check:schema-derivation` owns attribute derivation.
- `pnpm run check:schema-derivation`, part of the root `lint` chain, reads the Drizzle schema and fails when a feature `validation-schemas.ts` object literal mirrors a table while its values are hand-typed instead of derived (`table.shape.column`, `createSelectSchema(table)`, or a shared `<X>Schema`). A literal matches when at least three of its keys are columns of one table and those make up most of its keys; ties prefer the tightest table. Refinements, `z.enum(<derived>.options, { error })` and `base.pipe(<derived>)` still count as derived because the value set and validation stay with the column; plain `z.string()` and `z.enum([...])` do not.
- `pnpm run check:schema-duplication`, also in the `lint` chain, fails when the same Zod object shape — identical keys and identical value expressions, ignoring whitespace and key order — is declared in more than one feature schema module. Single-property literals count as patterns rather than shapes, and repeats inside one module are usually aliases. Keep one schema and import it; `--gate` is already enabled.
- `pnpm run check:schema-types` reports hand-written object `type` and `interface` declarations without `extends` whose members mirror a table's columns, where `typeof table.$inferSelect`, `InferSelectModel<…>` or `Pick<typeof table, …>` was the intended form. Matching is structural, but a type whose shared members are only labels (`id`, `name`, `country`, `email`, `slug`) is ignored because such a view model does not restate table data. The check is blocking: the `lint` chain runs it with `--gate`.
- Use Vitest for unit/integration tests and Playwright for browser flows. `@playwright/test` alone is enough — do not add the bare `playwright` package and do not use library mode (`import { chromium } from "playwright"`) in scripts; use the test runner (`import { test, expect } from "@playwright/test"`).
- Follow the process restrictions in `AGENTS.md`; repository configuration does not override them.

## Two verification loops

This section owns test selection and final verification policy. Follow it during implementation and final acceptance.

### Focused implementation

- Select the smallest meaningful checks for changed behavior and affected integration boundaries. Record the selection rationale. Expand coverage for shared auth, schema, router, SSR, or persistence changes.
- Keep pure unit/component checks server-free. Use focused `pnpm --dir <workspace> exec vitest run <file>` or `pnpm --dir <app> exec playwright test --config=<config> <file> --workers=1 --retries=0` when narrowing a suite.
- Runtime-dependent checks use existing loopback applications and the shared development database. Inspect Next MCP routes, errors, and compilation diagnostics when using an existing dev server, plus real browser observations before and after app changes.
- Existing-server checks accept dev or production servers without an attestation flag. They do not establish production provenance. Dev results do not prove production behavior. The operator owns build/start and final production verification against the reviewed candidate.
- Test runners never build, start servers, migrate, provision databases or stop existing processes. A run may seed the shared development database, because tests need canonical data. Cleanup follows [fixture ownership and quota expiry](#fixture-ownership-and-quota-expiry). Production and staging are excluded. Missing servers or credentials fail rather than skip. The only database target is `greendex_development` at `188.245.144.137:5489`, loaded from shared `packages/database/.env`; each app loads its own configuration automatically. Injected values retain precedence but must satisfy the same target restriction.

Representative focused selections:

| Changed behavior | Focused selection and rationale |
| --- | --- |
| Pure organization role rule | `pnpm --dir packages/auth exec vitest run src/organization-roles.test.ts`. No server is needed. |
| Browser/session setup | Against existing apps, use `pnpm --dir apps/cost-tracker exec playwright test --config=playwright.config.ts hosting-setup.spec.ts --workers=1 --retries=0`. Verify original-session success before reload or reauthentication. |
| Shared auth/schema/router | Expand to affected role/permission units, both apps' auth/procedure integrations, SSR routing, persistence, and cross-app session journeys. |

### Fixture ownership and quota expiry

Test-authored cleanup removes only run-owned rows, sessions, and storage objects. Preserve shared fixtures and mailboxes.

Real HTTP and browser checks against loopback applications may trigger the application's normal bounded cleanup of expired `principal_quota_counters` rows in the approved shared development database. Expired counters from other development fixtures may be removed by this maintenance. This exception covers application-triggered quota expiry only, not unrestricted cleanup called directly by tests. Active counters, business records, storage objects, and mail are outside the exception. Production and staging remain excluded.

Direct database integration tests isolate quota side effects to owned fixtures, or mock them when quota behavior is not under test. Tests of unrestricted quota cleanup use isolated temporary tables. Live HTTP and browser checks retain the application's normal quota behavior.

### Centrally owned final acceptance

Run repository-wide suites from the repository root.

- `pnpm run test:unit` runs the established server-free package/app selection with two workers, plus repository policy/tooling and Documentation tests.
- `pnpm run test:integration` runs the classifier-complement database/procedure tests, database connection and real OpenAPI HTTP checks, full real-mail workflows, and development Garage checks. Files and shared fixtures run serially. Migration/reset/lifecycle tests that provision additional databases are removed; the canonical development seed implementation remains outside test execution.
- `pnpm run test:e2e` runs both ordinary Playwright suites and the cross-app merge suite against existing apps, with one worker. The extra-build-only instant suite is removed.
- `pnpm run test:full` runs unit, integration and e2e sequentially and exits nonzero if any mode fails. Console summaries include sanitized timings. Implementing the command alone does not prove acceptance.

Run `pnpm run test:unit`, `pnpm run test:integration`, or `pnpm run test:e2e` from `apps/cost-tracker` for Cost Tracker-only coverage. These scripts use the same runner and result summaries as the root commands. Unit and integration selections use the same shared classifier as the root suites. Unit tests use two workers. Integration and E2E tests use one worker.

Cost Tracker-only integration and E2E runs require only the existing Cost Tracker app, its `.env`, and shared development database configuration. They do not require Calculator or its socket service. The app integration command runs Vitest service tests, including real HTTP checks. Separate live-mail workflows and Garage verification run under the root integration command.

Each command reports the suite exit code, pass or fail status, duration, candidate commit, branch, working-tree state, and overall exit code. Start and stop application servers separately.

Playwright reads `PLAYWRIGHT_RETRIES` from the existing app environment or injected environment, with injected values taking precedence. An unset value defaults to zero. Set a non-negative safe integer to enable retries; blank, fractional, negative, nonnumeric, and unsafe values fail configuration. A Playwright CLI `--retries` option overrides the config value. The configured reporters print the effective project retry count. Playwright's console output and HTML reports distinguish flaky tests that passed on retry from first-attempt passes. A CLI reporter override can replace the configured reporters. Do not treat retry-assisted passes as clean acceptance.

For an explicit local retry allowance on a high-load machine, use either command:

```bash
PLAYWRIGHT_RETRIES=1 pnpm run test:e2e
PLAYWRIGHT_RETRIES=1 PLAYWRIGHT_HTML_OPEN=never ./scripts/suite-evidence.py run e2e --dir .audit/retry-centralization
```

Investigate failures on their evidence. A retry-assisted pass does not establish that load caused the failure.

For a local E2E test server, set `GREENDEX_LOCAL_TEST_SERVER=1` in the environment when starting each app server. This applies to development servers and production-built local servers. The server then defaults `LOCAL_E2E_AUTH` to `1`, raising the email login limit to 30 requests per 10 seconds. The auth base URL must be loopback HTTP or HTTPS. Ordinary server launches default to `0`. Set `LOCAL_E2E_AUTH=0` to retain the normal limit, or `1` to opt in explicitly. Both variables accept only `0` or `1`. An app `.env` value of `LOCAL_E2E_AUTH=0` is an explicit override. Changing the test runner environment cannot reconfigure an already running server.

The browser inventory is:

- Cost Tracker, `apps/cost-tracker/playwright.config.ts`.
- Calculator, `apps/calculator/playwright.config.ts`.
- Cross-app merge, `apps/calculator/playwright.merge.config.ts`.

One coordinator owns final acceptance after all writers finish. Reviewers and implementers do not launch competing full runs. The operator owns starting the reviewed production builds, including the required socket service, and making the existing seed fixtures available. Runners borrow these resources and never dispose of them.

For final verification:

1. Preserve dedicated-mailbox/current-run correlation, default mail retention, development Garage isolation, owned-object cleanup, and sanitized evidence. Missing services or credentials are blockers. Apply [fixture ownership and quota expiry](#fixture-ownership-and-quota-expiry) to cleanup. Browser artifacts remain private, with trace, video and automatic screenshots off.
2. Require independent Standards and Spec reviews of the same integration candidate. Resolve findings with bounded focused repairs and review the changed final diff again.
3. Require zero flaky final acceptance. Use zero retries for final acceptance, including any CLI override. Report failures, blocks, skips and cleanup failures honestly; none prove a passed gate. A nonzero subprocess or real-workflow failure fails its mode; full still attempts the remaining modes.
4. Record the exact candidate, runtime targets, selected suites, results, timings, and blockers without secrets. Source/build-affecting changes invalidate relevant evidence. No fixed count of repeated green full runs is required.
5. Retain final `pnpm run format`, `pnpm run lint` including design-system checks, applicable `pnpm run type-check`, affected SSR regressions, persistence checks, instruction-policy checks and diff review. Account for overlap without omitting a gate. Honor explicit user restrictions on command execution and report unrun gates rather than inventing evidence.

### E2E artifact privacy

Cost Tracker E2E artifacts are private by policy, not guaranteed sanitized. Keep
`installArtifactPrivacy` dormant. The pure text redactor is not a reporting boundary.
Enable a replacement only after a supported pre-serialization boundary covers all
residual channels and a rejecting version assertion protects that boundary.

- Keep trace, video, and automatic screenshots off. Keep boolean full-URL matcher
  diagnostics and all routing, authorization, and data assertions intact.
- Treat stdout, reporter steps and errors, HTML reports and their embedded ZIPs,
  `error-context.md` DOM snapshots, and `.auth/storage-state.json` as private.
  Disabled trace capture does not disable every failure snapshot or session file.
- Do not publish or upload these outputs to PRs, issues, or public CI artifacts.
  Git ignores are not an access control or a retention policy.
- Use only generated synthetic values for privacy probes. Do not print probe values
  or private URLs. Restore induced failures and re-run affected specs before handoff.
- External CI access, retention, and discard remain manual operator responsibilities.
  Deleting captured artifacts is not evidence of a pre-serialization guarantee.

The [bounded #338 evidence report](../../../apps/cost-tracker/docs/archive/e2e-artifact-privacy-338.md)
records why the experimental runner hooks remain disabled.

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
