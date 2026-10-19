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
- The root `.oxlintrc.json` also loads the `@shadcn/lint` Oxlint JS plugin (declared as a root devDependency) and carries the design-system rules; because workspaces resolve that single config, every workspace lint run includes them. `pnpm run lint:design-system` is the focused check-only pass. Read [UI components](shadcn.md) before changing those rules.
- `ignorePatterns` and `overrides` entries are resolved relative to the config file directory, so keep them repository-root-relative.
- Tailwind-resolving lint rules run in the apps, auth, and email packages that ship class strings. Config, database, and i18n ship no Tailwind class strings and retain the scoped override. Oxlint overrides do not support `comment` keys; keep rationale here, not in configuration fields.
- Use Vitest for unit/integration tests and Playwright for browser flows.
- Follow the process restrictions in `AGENTS.md`; repository configuration does not override them.

## Two verification loops

This section owns test selection and final verification policy. Follow it during implementation and final acceptance.

### Focused implementation

- Select the smallest meaningful checks for changed behavior and affected integration boundaries. Record the selection rationale. Expand coverage for shared auth, schema, router, SSR, or persistence changes; do not omit affected tests.
- Keep pure unit/component checks server-free. Direct database, migration, and service tests retain their appropriate seams.
- Run runtime-dependent browser/HTTP checks against an isolated running dev server. Use Next MCP routes, errors, and compilation diagnostics plus real browser observations before and after app changes. Start an owned server when needed; do not reuse an unrelated server or database.
- For a changed production-only instant-navigation, prerender, or prefetch contract, use the smallest dedicated production-build check. Dev results do not prove production behavior.
- Do not run unrelated full suites or builds during ordinary fixing. Existing root `pnpm test` is the full non-browser contract; `pnpm run test:run` aliases it, not a cheap unit-only check.

Use these representative selections, not a mandatory command sequence:

| Changed behavior | Focused selection and rationale |
| --- | --- |
| Pure organization role rule | `pnpm --dir packages/auth run test:run src/organization-roles.test.ts`. No server is needed. |
| Browser/session setup | After provisioning the isolated environment and owned dev server, use `pnpm --dir apps/cost-tracker exec playwright test --config=playwright.config.ts hosting-setup.spec.ts --workers=1 --retries=0`. Inspect Next MCP and browser evidence of original-session success, before reload or reauthentication. |
| Shared auth/schema/router | Expand to affected role/permission units, both apps' relevant auth/procedure integrations, SSR routing, persistence, and cross-app session journeys. Select by affected boundary. |
| Production-only instant/prerender | Select the affected case in `apps/calculator/playwright.instant.config.ts` against a dedicated owned production build with build-time testing API enablement and a public unauthenticated context. Do not deploy that artifact. |

These examples require the relevant isolated environment and prerequisites. They do not authorize unsafe default start hooks, arbitrary listener termination, or ordinary development/staging database writes.

### Centrally owned final acceptance

- One coordinator owns heavy builds and full gates after all writers finish. Run heavy work sequentially with bounded browser/server concurrency. Implementers and reviewers do not launch competing full runs.
- Preserve the complete existing `pnpm test` non-browser contract, including unit, component, integration, migration, cross-app, policy, real mail, and storage groups with their failure and cleanup semantics.
- **PLANNED, unavailable until #284:** `pnpm run test:full` is the required final integrated entrypoint. It must include that non-browser contract and all four browser configurations below without recursive aggregates, duplicate group execution, or omitted coverage. #284 reconciles these command pointers when it implements the runner; #289 verifies final consistency. Until then, production acceptance is blocked. Current commands do not prove this planned gate.
- Final app HTTP/browser consumers must target production build/start artifacts from the reviewed candidate, including runtime-dependent non-browser HTTP checks. Units, direct database, migration, and service checks retain their appropriate runners. Production start does not require dev MCP; use startup/readiness, logs, HTTP/browser behavior, and results.

The required browser inventory is:

- Cost Tracker ordinary suite, `apps/cost-tracker/playwright.config.ts`.
- Calculator ordinary suite, `apps/calculator/playwright.config.ts`, excluding the separate instant specs.
- Cross-app merge suite, `apps/calculator/playwright.merge.config.ts`.
- Calculator instant-navigation suite, `apps/calculator/playwright.instant.config.ts`, using a separate build-time test-enabled artifact and public unauthenticated context without ordinary login setup or inherited auth state. Ordinary Calculator production verification keeps the testing API disabled.

For final verification:

1. Use run-owned migrated/canonically seeded databases, reserved ports, processes, required socket service, artifacts, and generated declarations. Both apps share the intended run database for browser/cross-app workflows. Keep dev and production variants separate. Never kill unowned listeners or migrate an ordinary development/staging database through default start hooks.
2. Preserve dedicated-mailbox/current-run correlation, default mail retention, development Garage isolation, owned-object cleanup, and sanitized evidence. Missing services or credentials are blockers, not permission to mock or skip required live checks. Do not expose secrets or assume browser artifacts are safe to publish.
3. Require independent Standards and Spec reviews of the same integration candidate. Resolve findings with bounded focused repairs, review the changed final diff again, then run the complete final matrix for the resulting candidate. Repeat for actionable findings or failures, not merely to obtain green.
4. Require zero flaky final acceptance. Use zero retries or verified failure on retry-pass. Report failures, blocks, skips, flaky results, and cleanup honestly. Any required failure, block, unaccounted skip, flaky result, or cleanup failure makes acceptance fail. Continue independent safe groups and mark dependent groups blocked.
5. Record the exact candidate, build variants, runtime targets, suite inventory, results, timings, flaky/skipped/blocked counts, and cleanup in sanitized current-run evidence. Source/build-affecting changes invalidate relevant evidence; rebuild affected artifacts. No fixed count of repeated green full runs is required.
6. Retain final `pnpm run format`, `pnpm run lint` (including design-system checks), applicable `pnpm run type-check`, affected SSR regressions, persistence checks, instruction-policy checks after instruction changes, and diff review. Account for overlap without omitting a gate. For instruction-only work, run focused inventory/policy/link/budget and style checks; the coordinator owns final repository-wide gates.

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
- Include tests and documentation when behavior or an operational invariant changes.
