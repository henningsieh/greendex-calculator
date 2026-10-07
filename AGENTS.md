# Agent Instructions

**Greendex Calculator** — Next.js 16 monorepo (calculator + cost-tracker + documentation apps, shared packages) for carbon-footprint calculations. pnpm, Node.js 22+, ESM, Oxc, Vitest + Playwright.

## 🚨 Critical Rules

- Never start a dev server (`pnpm run dev`, `npm run dev`, `yarn dev` — one already runs on the respective app's port). Never run destructive git commands (`push --force`, `reset --hard`, …).
- Allowed: `pnpm run build` / `start` / `lint` / `format` / `test…`, read-only git plus `add` / `commit` / `checkout -b`, file reads and searches. Builds and deploys are Coolify-managed — see the [Coolify runbook](docs/agents/instructions/coolify.md) and never hand-edit generated compose output. Never commit credentials.

## Contexts

Before changing app code, read the shared [glossary](GLOSSARY.md) and the owning app glossary. [GLOSSARY-MAP.md](GLOSSARY-MAP.md) identifies contexts, relationships, and behavior routes.

## Agent skills

### Issue tracker

Issues and specs live on GitHub. Follow [issue-tracker rules](docs/agents/issue-tracker.md), including keeping implementation tickets open until merged.

### Triage labels

Use the five default roles mapped in [triage labels](docs/agents/triage-labels.md).

### Domain docs

Multi-context: shared root glossary plus app glossaries, discovered through [GLOSSARY-MAP.md](GLOSSARY-MAP.md). Read [domain rules](docs/agents/domain.md) when changing language, relationships, business rules, or persistence.

## Where Does a Statement Belong?

Documentation has five kinds with different rules. Placing a statement in the wrong kind is the most common way this repo gets confusing, so pick deliberately before writing.

| Kind            | Rule                                                                                                | Lives in                                                                               | Answers                               |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| **Decision**    | Immutable. Reversal means a new ADR that supersedes the old one.                                    | [`docs/adr/`](docs/adr/README.md)                                                      | Why this shape, and what was rejected |
| **Instruction** | Mutable current rules. Rewrite when the practice changes.                                           | [`docs/agents/instructions/`](docs/agents/instructions/)                               | How to work here now                  |
| **Model**       | Mutable domain descriptions: glossaries define names; behavior docs describe rules and persistence. | [Glossaries](GLOSSARY-MAP.md), [shared Projects](docs/projects/README.md), app `docs/` | What the things are                   |
| **Open work**   | Mutable. Needs a decision or an implementation.                                                     | [GitHub issues](docs/agents/issue-tracker.md); app `docs/backlog/`                     | What still needs doing                |
| **Archive**     | Frozen. Never follow as instructions.                                                               | app `docs/archive/`                                                                    | What was true at a past review        |

Rules that follow from this:

- An archived document states what was true at its review. It is not a decision record and never regains authority. When its content describes a codebase that no longer exists, move it to `archive/` and link the live replacement from the index.
- A "Q" numbered entry in an archived review is a closed decision unless the surrounding section says otherwise. Do not read a binding decision log as a work list.
- Deferred work belongs in an issue or the backlog, never inside an archived file. Keep the backlog linked from the app's documentation index; an unindexed backlog is a backlog nobody reads.
- Never link from a live document to a file that does not exist on the current branch. Check directory links too, not only file links.

## Read Conditionally (Default: Read Nothing Up Front)

Do not pre-read documentation. Open only what the task touches, when you need it:

- Code under `apps/<app>/` → read the shared `GLOSSARY.md` and that app's `GLOSSARY.md` first; use [the map](GLOSSARY-MAP.md) for behavior routes.
- Domain language, relationships, or persistence → [domain](docs/agents/domain.md).
- Files match a row of the scoped index below → read only that instruction file.
- Unfamiliar or cross-cutting work → [task routes](docs/agents/agent-workflows.md) or the [documentation index](docs/README.md).
- Vendor APIs → [integrations](docs/agents/integrations.md): confirm the installed version, then fetch only the smallest relevant official page.
- Next.js behavior → version-matched docs in the single catalog-resolved install at `node_modules/next/dist/docs/`, not model memory.
- Touching the SSR/oRPC seam → [oRPC](docs/agents/instructions/orpc.md): preserve both `@/lib/orpc/client.server` imports and their evaluation order.
- UI components → [UI components](docs/agents/instructions/shadcn.md) (`@shadcn/lint` rules in the root `.oxlintrc.json`).
- Issue-tracked work → [issue tracker](docs/agents/issue-tracker.md), [triage labels](docs/agents/triage-labels.md).
- Delegation or child recovery → [delegation policy](docs/agents/delegation.md).

## Delegation

For requested repo work, the main agent may delegate bounded implementation, research, and review when a child earns its overhead; do tiny tasks directly. The main agent owns scope, decisions, review sequencing, and final acceptance. Children execute their contract and escalate decisions; they do not launch other agents. Commits and external writes require explicit task permission.

Use fresh child context with relevant paths, repo rules, and a short task contract. Routine results: at most 200 words plus evidence/artifact paths, not raw logs. Children read their matching app/scoped docs; the main agent reads deeper only to resolve a decision or verify evidence. Keep one writer per worktree, including formatting and lint fixes; the main agent does not edit an active child's worktree.

## Commit Conventions

Conventional Commits 1.0.0: `<type>[optional scope]: <description>`, imperative, no trailing period. One logical change per commit; breaking changes take `!` plus a `BREAKING CHANGE:` footer.

## Scoped Instruction Index

The instruction files below live under [`docs/agents/instructions/`](docs/agents/instructions/).

<!-- AGENT-INSTRUCTION-INDEX-START -->

| Instruction            | Read before changing                                              | Scope summary                           |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| `architecture.md`      | Module placement, workspace boundaries, SSR/server-client flow    | App and package sources                 |
| `better-auth.md`       | Authentication, organizations, sessions, permissions, auth schema | Auth/organization code and auth schema  |
| `code-standards.md`    | TypeScript, React, persistence, errors, tests                     | App, package, and script sources        |
| `conventions.md`       | Manifests, configuration, environment, quality workflow           | Repo config and lint tooling            |
| `coolify.md`           | Deployment resources, environment values, managed databases       | Deployment config and ops docs          |
| `documentation-app.md` | Fumadocs application ownership and integration                    | Documentation app source                |
| `drizzle.md`           | Schemas, migrations, and Drizzle ORM/Kit usage                    | Database source and auth schema         |
| `email.md`             | Templates, localization, delivery, and SMTP injection             | Email package and calculator adapter    |
| `i18n.md`              | Messages, locale routing/navigation, country presentation         | i18n package and localized routes       |
| `nuqs.md`              | URL search-parameter state, parsers, Next.js adapter              | Provider, pages, and feature components |
| `orpc.md`              | Procedures, middleware, router, OpenAPI, SSR clients              | Procedures, routes, and SSR seam        |
| `shadcn.md`            | Shared/feature components, forms, accessibility                   | Components and design-system lint       |
| `tanstack-query.md`    | Query caching, options, mutations, prefetching, SSR, hydration    | Query integration surfaces              |
| `tanstack-table.md`    | Table v9 features, state, columns, and table tests                | Feature tables and table tests          |
| `workspace.md`         | Dependencies, catalog, workspace packages, Turbo tasks/env        | Manifests and Turbo config              |

<!-- AGENT-INSTRUCTION-INDEX-END -->

## Agent Checklist

Before final delivery (the main agent owns these gates after shared-worktree children finish; children run their assigned focused checks):

- [ ] No forbidden commands were executed
- [ ] Only the matching scoped instruction(s) were read — no speculative pre-reading
- [ ] Tests updated for changed functionality
- [ ] `pnpm run format && pnpm run lint` executed and passing
- [ ] `pnpm run check:agent-instructions` passes after instruction changes

**The developer is always in control. Agents are assistants, not controllers.**

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
