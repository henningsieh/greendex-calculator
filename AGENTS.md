# Agent Instructions

**Greendex Calculator** — Next.js 16 monorepo (calculator + documentation apps, shared packages) for carbon footprint calculations. pnpm, Node.js 22+, ESM, Oxc, Vitest + Playwright.

## 🚨 Critical Rules

- Never start a dev server (`pnpm run dev`, `npm run dev`, `yarn dev` — one already runs on port 3000). Never run destructive git commands (`push --force`, `reset --hard`, …).
- Allowed: `pnpm run build` / `start` / `lint` / `format` / `test…`, read-only git plus `add` / `commit` / `checkout -b`, file reads and searches. Builds and deploys are Coolify-managed — see the [Coolify runbook](docs/agents/instructions/coolify.md) and never hand-edit generated compose output.

## Commit Conventions

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<type>[optional scope]: <description>`, imperative, concise, no trailing period (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`, `perf`). Breaking changes take `!` plus a `BREAKING CHANGE:` footer. One logical change per commit.

## Read Conditionally (Default: Read Nothing Up Front)

Do not pre-read documentation. Open only what the task touches, when you need it:

1. Match the files you will edit to one row of the scoped index below and read only that instruction file.
2. For vendor APIs, follow that file to its route in [integrations.md](docs/agents/integrations.md): confirm the installed version, then fetch only the smallest relevant official page.
3. Open [task routes](docs/agents/agent-workflows.md) or the [documentation index](docs/README.md) only for unfamiliar or cross-cutting work — never by default.

## Topic Pointers (Only When the Task Touches Them)

- Deployments, databases, environment values, preview runbook, incidents: [Coolify](docs/agents/instructions/coolify.md). It is the single source for project/environment IDs and the application contract; never commit credentials.
- Authentication, organizations, OAuth callback paths: [Better Auth](docs/agents/instructions/better-auth.md).
- Module placement, workspace boundaries, SSR/server-client flow: [Architecture](docs/agents/instructions/architecture.md).
- **Critical oRPC invariant:** preserve both imports of `@/lib/orpc/client.server` and their evaluation order. Read [oRPC](docs/agents/instructions/orpc.md) before touching that seam.
- Next.js API behavior: read the version-matched docs bundled in the single catalog-resolved install at `node_modules/next/dist/docs/` (they upgrade with the `next` package) instead of relying on model memory.
- Issue-tracked work: [issue tracker](docs/agents/issue-tracker.md). Triage/labels: [triage labels](docs/agents/triage-labels.md). Domain-language changes: [domain](docs/agents/domain.md) and the [canonical glossary](DOMAIN-GLOSSARY.md).

## Scoped Instruction Index

The instruction files below live under [`docs/agents/instructions/`](docs/agents/instructions/).

<!-- AGENT-INSTRUCTION-INDEX-START -->

| Instruction            | Read before changing                                              | Scope summary                                               |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `architecture.md`      | Module placement, workspace boundaries, SSR/server-client flow    | App and package source files                                |
| `better-auth.md`       | Authentication, organizations, sessions, permissions, auth schema | Auth/organization implementation                            |
| `code-standards.md`    | TypeScript, React, persistence, errors, tests                     | App and package source files                                |
| `conventions.md`       | Manifests, configuration, environment, quality workflow           | Repository configuration                                    |
| `coolify.md`           | Deployment resources, environment values, managed databases       | Deployment configuration and operational documentation      |
| `documentation-app.md` | Fumadocs application ownership and integration                    | Documentation application source                            |
| `drizzle.md`           | Schemas, migrations, and Drizzle ORM/Kit usage                    | Database source and auth schema generation                  |
| `email.md`             | Templates, localization, delivery, and SMTP injection             | Email package and Calculator adapter                        |
| `i18n.md`              | Messages, locale routing/navigation, country presentation         | i18n package and localized app routes                       |
| `nuqs.md`              | URL search-parameter state, parsers, Next.js adapter              | Calculator provider, pages, layouts, and feature components |
| `orpc.md`              | Procedures, middleware, router, OpenAPI, SSR clients              | oRPC, feature procedures, app routes                        |
| `shadcn.md`            | Shared/feature components, forms, accessibility                   | Calculator component files                                  |
| `tanstack-query.md`    | Query caching, options, mutations, prefetching, SSR, hydration    | Query integration surfaces                                  |
| `tanstack-table.md`    | Table v9 features, state, columns, and table tests                | Feature tables and table tests                              |
| `workspace.md`         | Dependencies, catalog, workspace packages, Turbo tasks/env        | Manifests, workspace and Turbo config                       |

<!-- AGENT-INSTRUCTION-INDEX-END -->

## Agent Checklist

Before submitting work:

- [ ] No forbidden commands were executed
- [ ] Only the matching scoped instruction(s) were read — no speculative pre-reading
- [ ] Both server-side oRPC initialization paths preserved
- [ ] Tests updated for changed functionality
- [ ] `pnpm run format && pnpm run lint` executed and passing
- [ ] `pnpm run check:agent-instructions` passes after instruction changes

**The developer is always in control. Agents are assistants, not controllers.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
