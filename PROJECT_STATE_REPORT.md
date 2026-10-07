# Greendex Calculator — Current Project State

> **Updated:** 2026-08-23
>
> **Repository:** `henningsieh/greendex-calculator`
>
> **Branch:** `main`
>
> **HEAD:** `320c3819cf23fe579fcc190fa1beef70f9a4a9f2`

This report extends the August 20–22 snapshot through the merge of the
email-package migration into `main`. It records the current state after
reviewing every commit from `6bbd947` through `320c381`, including all changes
since `dc5a3cc`.

---

## 1. Executive snapshot

- `main` includes the seven-commit email-package migration through merge commit
  `320c381`; PR #57 is the corresponding branch integration.
- The project is a pnpm/Turborepo monorepo with two Next.js applications and
  five shared workspace packages.
- Transactional templates, rendering, and delivery are centralized in
  `@greendex/email`; the calculator retains only environment-specific SMTP and
  application-URL wiring.
- A missing server-side oRPC initialization import was identified as the cause
  of existing internal and public project pages rendering misleading Next.js
  404s. The locale layout now initializes the direct server client before SSR
  consumers load.
- Node.js `>=22` is enforced by the root package manifest and `.node-version`.
- Oxfmt behavior, including import sorting, is centralized in the root
  `.oxfmtrc.json`.
- The Playwright suite now contains **12 tests**, including regressions for an
  authenticated project page and a public participation page; all 12 passed in
  a headed run against the seeded development server.
- The current framework catalog pins Next.js `16.3.2`, React `19.2.8`,
  TypeScript `7.0.2`, and next-intl `4.13.7`.
- The only shared deployment remains Coolify's `development` environment at
  <https://greendex.apps.sieh.org>. No separate production environment exists.
- PR #11 remains stale and targets an old Copilot branch rather than `main`.

---

## 2. Reviewed development range

The prior snapshot reviewed `6bbd947` through `5e9da4b`. The latest sync reviews
the open branch relative to `origin/main` and specifically the six commits after
`dc5a3cc`:

```bash
git diff 5e9da4b...320c381
git log 5e9da4b..320c381 --oneline

git diff dc5a3cc...320c381
git log dc5a3cc..320c381 --oneline
```

### Net branch change since `origin/main`

- **7 commits**
- **112 files changed**
- **580 additions / 1,118 deletions**
- Most deletions come from removing duplicated app-level email implementation
  and per-app Oxfmt configuration.

### Main development themes

1. Coolify build and environment propagation stabilization
2. Workspace-wide dependency and toolchain modernization
3. Better Auth/database compatibility migration
4. Next.js, Fumadocs, React Email, and TanStack Table compatibility refactors
5. Transactional email centralization in `@greendex/email`
6. SSR oRPC initialization repair and project-routing regression coverage
7. Root-level Oxfmt/import-sorting configuration
8. Node.js 22+ runtime enforcement
9. Locale-switcher implementation simplification
10. Test hardening and project statistics typing
11. VS Code / TypeScript native tooling setup
12. Product-name correction from “Greedex” to “Greendex”

---

## 3. Complete commit ledger

### August 20 — deployment and environment stabilization

| Commit    | Change                                                                                | Final effect                                                                                         |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `6bbd947` | Turbo updated to `2.10.10`                                                            | Superseded by `5d55ac0`                                                                              |
| `5d55ac0` | Turbo updated to `2.10.11`                                                            | Current Turbo version                                                                                |
| `1eda256` | Added Dockerfile and `.dockerignore` for Coolify env propagation                      | Experimental; later reverted                                                                         |
| `6bb9612` | Added Docker health check                                                             | Experimental; later reverted                                                                         |
| `d36151b` | Adjusted broken Coolify build-arg handling and health check                           | Experimental; later reverted                                                                         |
| `ba86bed` | Reverted the Dockerfile approach                                                      | **Final state: no repository Dockerfile**                                                            |
| `275ddaa` | Added `env: ["*"]` to the Turbo `build` task                                          | Build tasks receive Coolify-injected variables                                                       |
| `d67c610` | Socket server switched to validated `@/env`; local scripts gained environment loading | Same entrypoint works locally and on Coolify; current scripts use app-local `.env` with `dotenv run` |
| `5f301a0` | Reworked Scalar/OpenAPI UI test around stable page markers                            | Faster, less version-fragile test                                                                    |
| `f8ddfda` | Added `NEXT_PUBLIC_SOCKET_URL`                                                        | Socket clients no longer derive URLs by replacing ports                                              |
| `675c62a` | Published a complete root `.env.example`                                              | Canonical environment-variable inventory                                                             |

### August 21 — dependency modernization branch

These commits were developed on
`chore/updating-libraries-packages-dependencies` and merged into `main` by
`382bce5`.

| Commit    | Change                                                                       | Final effect                                                                                         |
| --------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `bbc53ea` | Updated workspace libraries and introduced a pnpm catalog                    | Centralized core versions in `pnpm-workspace.yaml`                                                   |
| `e3c5c5c` | Migrated React Email imports from `@react-email/components` to `react-email` | Current React Email package API used in app and workspace package                                    |
| `e14f94f` | Generated Better Auth issuer migration                                       | Adds account issuer and unique issuer/account index; also captures pending distance precision change |
| `8a3ba2e` | Restored Next.js layout/script compatibility                                 | Root layout owns `<html>/<body>` and JSON-LD; locale layout owns providers/fonts                     |
| `93f22cc` | Typed project-statistics participants                                        | Replaced `Array<unknown>` with `ProjectParticipantWithUser[]`                                        |
| `34da9a8` | Refreshed development guidance                                               | Added Next agent docs and memory-debugger guidance                                                   |
| `b484d1f` | Asserted invalid activity diagnostics                                        | Tests now verify unknown activity types are reported                                                 |
| `1e3390f` | Upgraded Next.js                                                             | Current version `16.3.2`                                                                             |
| `fd57215` | Modernized VS Code JS/TS settings                                            | Intermediate editor migration                                                                        |
| `37f97fb` | Replaced Base UI combobox with Radix command menu                            | Removed custom 310-line combobox and `@base-ui/react`; retained searchable locale UI                 |
| `caa93e7` | Aligned i18n Next peer dependencies with catalog                             | next/next-intl versions stay synchronized                                                            |
| `93230f2` | Removed seed script dependency on Better Auth hex utility                    | Uses Node `Buffer`; seeds account `issuer`                                                           |
| `5f696eb` | Upgraded Fumadocs packages                                                   | Current docs app dependencies and layout API                                                         |
| `a2196ca` | Upgraded Lucide React                                                        | Current version `1.33.0`                                                                             |
| `a056a4d` | Upgraded UI dependencies                                                     | Includes Tailwind `4.3.3`, React Day Picker `10`, Motion `13`, and related compatibility fixes       |
| `54bed76` | Upgraded Nodemailer                                                          | Current version `9.0.5`                                                                              |
| `cc12c1f` | Upgraded TypeScript                                                          | Current catalog version `7.0.2`                                                                      |
| `20b9eba` | Upgraded Vite React plugin and ESM config usage                              | Vite `8.2.2`, plugin `6.1.0`, `import.meta.dirname` aliases; root `.npmrc` removed                   |
| `ee1ab0f` | Migrated TanStack Table to v9                                                | Explicit table features, `useTable`, and v9 state/sort APIs                                          |
| `4e31acc` | Fixed canonical Tailwind selector syntax                                     | Updated project-table checkbox selector                                                              |
| `c5d615d` | Centralized Better Auth version                                              | Current catalog version `1.7.1`                                                                      |
| `382bce5` | Merged dependency-upgrade branch into `main`                                 | Integrates all commits above                                                                         |

### August 21–22 — documentation, deployment guidance, and tooling

| Commit    | Change                                                | Final effect                                                                                |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dc19dab` | Generate Fumadocs sources before documentation build  | `fumadocs-mdx && next build`                                                                |
| `7c6dd6a` | Load Fumadocs Next config as ESM                      | Documentation config renamed to `next.config.mjs`                                           |
| `0221217` | Added Coolify deployment/database guidance            | Shared development infrastructure is now documented in agent context                        |
| `c8d7fee` | Added TypeScript 7 catalog dependencies to workspaces | Workspace type-check scripts resolve the pinned compiler                                    |
| `4b7e353` | Reorganized VS Code settings and recommendations      | Enables TypeScript native preview and adds recommended extensions                           |
| `5e9da4b` | Corrected “Greedex” to “Greendex”                     | Product/API/docs naming aligned; canonical GitHub repo is `henningsieh/greendex-calculator` |

### August 23 — email migration, SSR repair, and tooling

These commits were integrated into `main` by merge commit `320c381`; PR #57 is
the corresponding branch integration.

| Commit    | Change                                                          | Final effect                                                                                            |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `dc5a3cc` | Centralized transactional email in `@greendex/email`            | Shared package owns templates/rendering/delivery; calculator injects SMTP and base-URL configuration    |
| `b2fb1bc` | Applied CodeRabbit follow-up fixes                              | Hardened required environment-variable and SMTP test-script handling                                    |
| `c6d8738` | Converted `getRequiredEnvironmentVariable` to an arrow function | Aligns helper style with project conventions                                                            |
| `33ebbea` | Reworked malformed and out-of-range SMTP port handling          | Test-email script accepts only valid integer ports in the TCP range                                     |
| `17d3537` | Centralized Oxfmt import sorting and restored SSR oRPC setup    | Root formatter config replaces per-app configs; locale layout initializes the server oRPC client        |
| `a14731a` | Enforced Node.js 22+                                            | Root `engines.node` is `>=22`, `.node-version` is `22`, and oRPC guidance names the runtime requirement |
| `d08842a` | Added project-routing E2E regressions                           | Playwright guards authenticated project details and public participation routes against misleading 404s |
| `320c381` | Merged the email-package branch into `main`                     | Integrates the seven commits above into the mainline                                                    |

---

## 4. Current architecture

### Workspace map

| Workspace            | Responsibility                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `apps/calculator`    | Main Next.js application, oRPC/REST APIs, Better Auth integration, Socket.IO server, Vitest and Playwright tests |
| `apps/documentation` | Fumadocs/Next.js documentation application on local port `3001`                                                  |
| `packages/auth`      | Shared Better Auth client types/utilities                                                                        |
| `packages/config`    | Shared activities, locales, metadata, pagination, partners, and workshop configuration                           |
| `packages/database`  | Drizzle PostgreSQL client, schemas, migrations, and database scripts                                             |
| `packages/email`     | Reusable React Email templates and Nodemailer helpers                                                            |
| `packages/i18n`      | next-intl client/server exports and seven locale files                                                           |

### Runtime and API layers

- **Next.js App Router:** `apps/calculator/src/app/`
- **Feature modules:** `apps/calculator/src/features/`
- **Better Auth app configuration:**
  `apps/calculator/src/lib/better-auth/index.ts`
- **Database package:** `packages/database/`
- **oRPC router:** `apps/calculator/src/lib/orpc/router.ts`
- **Internal RPC:** `/api/rpc`
- **REST/OpenAPI:** `/api/openapi`
- **Interactive Scalar docs:** `/api/docs`
- **OpenAPI JSON:** `/api/openapi-spec`
- **Health check:** `/api/rpc/health`
- **Socket.IO process:** `apps/calculator/src/socket-server.ts`

### Internationalization

The UI has seven configured locales:

- English (`en`)
- German (`de`)
- Spanish (`es`)
- Italian (`it`)
- French (`fr`)
- Dutch (`nl`)
- Slovenian (`si`)

The calculator's language switcher is searchable by English name, native label,
and locale code using the existing Radix Popover + cmdk Command primitives.

---

## 5. Current toolchain

| Tool              | Current state                    |
| ----------------- | -------------------------------- |
| Node.js           | `>=22` (`.node-version`: `22`)   |
| Package manager   | pnpm `10.28.2`                   |
| Monorepo runner   | Turbo `2.10.11`                  |
| Next.js           | `16.3.2`                         |
| React / React DOM | `19.2.8`                         |
| TypeScript        | `7.0.2`                          |
| next-intl         | `4.13.7`                         |
| Better Auth       | `1.7.1`                          |
| oRPC              | `1.15.x`                         |
| TanStack Query    | `5.101.4`                        |
| TanStack Table    | `9.1.2`                          |
| Vite / Vitest     | `8.2.2` / `4.1.11`               |
| Tailwind CSS      | `4.3.3`                          |
| React Email       | `6.9.2`                          |
| Nodemailer        | `9.0.5`                          |
| Lint / format     | Oxlint `1.79.0` / Oxfmt `0.64.0` |

Core framework/tool versions are centralized in the pnpm workspace catalog.
The former root `.npmrc` was removed; supported workspace settings now live in
`pnpm-workspace.yaml`. Oxfmt configuration and import sorting now live in the
root `.oxfmtrc.json`; app-specific `.oxfmtrc.json` files were removed.

---

## 6. Deployment and environment state

### Coolify

- Greendex currently has **one shared `development` environment**.
- Calculator URL: <https://greendex.apps.sieh.org>
- Health check: `GET /api/rpc/health` on port `3000`
- There is no separately configured production environment.
- The application currently targets the live Greendex PostgreSQL database on
  Coolify's private Docker network.
- Persistent infrastructure changes must be made through Coolify, not by
  editing generated compose files on the host.

### Final build/environment model

1. The Dockerfile experiment was fully reverted.
2. Coolify injects environment variables into its build/runtime environment.
3. `turbo.json` forwards all variables to `build` and `start` tasks.
4. Local Calculator scripts load `apps/calculator/.env` through
   `dotenv run` from the `dotenv` package.
5. The Socket.IO module itself reads only the validated shared `@/env` module.
6. Browser socket connections use `NEXT_PUBLIC_SOCKET_URL`.

`apps/calculator/.env.example` is the Calculator variable inventory. Secrets remain in local or
Coolify-managed environment configuration and must never be committed.

---

## 7. Database and auth state

- Drizzle schemas and migrations now live in `packages/database/`.
- Better Auth's generated schema includes `account.issuer`.
- Migration `0009_abandoned_black_panther.sql`:
  - changes `project_activity.distance_km` to `decimal(10,1)`;
  - adds non-null `account.issuer`;
  - creates unique index `(issuer, account_id)`.
- The seed script now sets `issuer: "local:credential"` and uses Node `Buffer`
  instead of Better Auth's internal hex helper.
- New/empty databases must receive migrations before Better Auth is tested.

### Migration caution

The generated migration adds a non-null `issuer` without a default. If it has
not already been applied and the target `account` table contains rows, confirm a
backfill/migration strategy before applying it. Deployment state of migration
`0009` was **not** verified as part of this source review.

---

## 8. Quality and compatibility work

- Scalar/OpenAPI UI test now uses stable DOM markers and shorter timeouts.
- Project statistics accept the actual participant domain type.
- Unknown project-activity types are asserted through a controlled
  `console.error` spy.
- Next.js layout structure was corrected for compatibility: root layout owns
  `<html>/<body>` and JSON-LD; locale layout owns locale providers and fonts.
- Fumadocs sources are generated before regular documentation builds.
- Documentation config is ESM (`next.config.mjs`).
- TanStack Table consumers use v9's explicit feature model.
- VS Code is configured for TypeScript's native Go language service through the
  TypeScript Native Preview extension.
- Transactional email behavior is covered by a calculator sender test while
  reusable templates and delivery logic live in `@greendex/email`.
- SMTP test-script parsing rejects malformed, fractional, negative, zero, and
  out-of-range ports instead of silently coercing them.
- The locale layout imports `@/lib/orpc/client.server` before SSR oRPC consumers;
  this prevents server rendering from falling back to the browser-only RPC link.
- `project-routing.spec.ts` verifies that existing authenticated and public
  projects render rather than returning a misleading 404.
- Agent guidance now uses one `AGENTS.md` router, eight narrowly scoped
  `.instructions.md` modules, an opt-in task workflow, and an automated drift
  check integrated into the root lint command.

---

## 9. GitHub and branch state

### Pull requests

| PR  | State    | Note                                                                                         |
| --- | -------- | -------------------------------------------------------------------------------------------- |
| #11 | **OPEN** | Stale CodeRabbit unit-test PR; base is old `copilot/update-breadcrumb-component`, not `main` |
| #57 | Merged   | Email-package migration integrated into `main` by `320c381`                                  |
| #35 | Closed   | Docker/bun containerization experiment; branch deleted                                       |
| #50 | Closed   | pnpm-to-bun migration rejected; branch deleted                                               |
| #54 | Closed   | Superseded Dependabot update; branch deleted                                                 |
| #55 | Closed   | Superseded Dependabot update                                                                 |
| #56 | Closed   | Dependency update was not merged as a PR; its remote branch still exists                     |

### Remaining cleanup candidates

- `chore/updating-libraries-packages-dependencies` exists locally and remotely,
  but has **0 commits ahead of `main`**. It is fully merged and safe to delete.
- `origin/dependabot/npm_and_yarn/npm_and_yarn-a154c3674e` remains after closed
  PR #56. It is an orphaned remote branch and is not part of current `main`.
- `bun-runtime` still exists locally and remotely with two old unique commits;
  it is far behind `main` and contradicts the pnpm-only decision.
- There are currently 57 local branch refs, 52 origin-tracking refs, and eight
  stashes. Most are historical/merged and can be reviewed in a separate cleanup.
- No Git tags currently exist.

The old `lang-toggle-combobox-search`,
`copilot/migrate-greendex-calculator`, and merge-backup branches have now been
removed locally and remotely.

---

## 10. Known inconsistencies and next decisions

1. **Migration `0009`:** confirm live schema/application status and backfill safety.
2. **OpenAPI integration tests are not hermetic:** `openapi-rest.test.ts` expects a
   server on `localhost:3000`. Its collection/skip behavior still depends on server
   availability and should be separated from the hermetic unit suite.
3. **Stale PR/branches/stashes:** #11, `bun-runtime`, the merged dependency branch,
   the orphaned Dependabot branch, and eight stashes remain cleanup candidates.
4. **No license selected:** the repository still has no finalized license.

---

## 11. Documentation-sync validation

- Commit history and final diffs were inspected through merge commit `320c381`,
  including all seven integrated commits and all six commits after `dc5a3cc`.
- Current package manifests, Node runtime pins, formatter configuration, email
  package boundaries, SSR oRPC initialization, E2E fixtures, branches, PRs, and
  stashes were cross-checked.
- Code/spec review note: no originating issue or single spec exists for this
  multi-topic range. `docs/agents/issue-tracker.md` is also absent; run
  `/setup-matt-pocock-skills` before future issue-linked reviews.

### Validation results

- `pnpm --dir apps/calculator exec vitest run` — **17 files / 176 tests passed**.
- `HEADED=true pnpm --dir apps/calculator exec playwright test --headed` —
  **12/12 tests passed**, including both project-routing regressions.
- `pnpm run lint` — **7/7 workspace lint tasks passed with 0 errors** and the
  agent-instruction drift check passed. Existing warnings remain in
  `packages/config/src/index.ts` and
  `apps/calculator/src/components/ui/text-effect.tsx`.
- `pnpm run check:agent-instructions` — **8/8 scoped instruction files passed**
  inventory, scope, reference, stale-pattern, and critical-invariant checks.
- Documentation formatting and `git diff --check` are rerun after this sync.
