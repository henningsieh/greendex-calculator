# Greendex Calculator

Greendex Calculator is a multilingual participant and organization portal for
measuring the carbon footprint of Erasmus+ mobility projects. It combines
project administration, participant journeys, emissions calculations,
workshops, and sustainability education in one application.

> **Current stage:** active development. The only shared deployment is the
> Coolify `development` environment at
> [greendex.apps.sieh.org](https://greendex.apps.sieh.org). No separate
> production environment is configured yet.

## What the application supports

- Organization onboarding, user membership, invitations, and role-based permissions
- Project creation, editing, filtering, sorting, archiving, and batch actions
- Participant management and a public participation/questionnaire flow
- Project Shared Travel Legs, travel distances, and CO₂ statistics
- Email/password, magic-link, and Google/GitHub/Discord authentication
- Transactional verification, reset-password, and invitation emails
- Seven UI locales with a searchable language switcher
- Internal type-safe oRPC plus REST/OpenAPI and interactive Scalar documentation
- A separate Socket.IO proof of concept for future real-time features
- A Fumadocs application for project/user documentation

The broader Greendex initiative also includes workshop formats, educational
resources, sustainability challenges, and the Greendex E-Forest. Learn more at
[greendex.world](https://greendex.world).

### Domain language

Greendex uses these canonical terms for people in the system:

- **Organization Administrator** — manages an organization, its users, and its projects
- **Project Coordinator** — manages projects and coordinates Participants
- **Participant** — takes part in a project and submits participation data

These terms are the product language. The complete wording glossary, including
terms to avoid, is in [`DOMAIN-GLOSSARY.md`](DOMAIN-GLOSSARY.md).

---

## Current technology

| Area                 | Technology                                         |
| -------------------- | -------------------------------------------------- |
| Web applications     | Next.js, React, App Router, React Compiler          |
| Language             | TypeScript                                         |
| Monorepo             | Turborepo and pnpm workspaces/catalog              |
| UI                   | shadcn/ui, Radix UI, cmdk, Tailwind CSS             |
| Authentication       | Better Auth with organization and social providers |
| API                  | oRPC, TanStack Query, OpenAPI/Scalar                |
| Database             | PostgreSQL and Drizzle ORM/Kit                     |
| Tables               | TanStack Table                                     |
| Internationalization | next-intl                                          |
| Email                | React Email and Nodemailer                         |
| Real-time POC        | Socket.IO                                          |
| Documentation        | Fumadocs and Next.js                               |
| Tests                | Vitest and Playwright                              |
| Quality              | Oxlint and Oxfmt                                   |

The owning workspace manifests, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` are
the version authorities. Formatter behavior, including import sorting, is
centralized in the root `.oxfmtrc.json`. See the
[integration registry](docs/agents/integrations.md) for project maps, official
online documentation, and skill choices.

---

## Repository layout

```text
.
├── apps/
│   ├── calculator/          # Main Next.js app, APIs, auth integration, tests, Socket.IO
│   └── documentation/       # Fumadocs app (local port 3001)
├── packages/
│   ├── auth/                # Shared Better Auth client types/utilities
│   ├── config/              # Domain, locale, metadata, and UI configuration
│   ├── database/            # Drizzle client, schemas, and migrations
│   ├── email/               # Shared React Email templates and SMTP helpers
│   └── i18n/                # next-intl exports and locale JSON files
├── docs/                    # Developer/reference documentation
├── apps/*/.env.example      # Per-application environment-variable inventories
├── pnpm-workspace.yaml      # Workspaces and shared dependency catalog
├── turbo.json               # Task graph, caching, and env forwarding
└── package.json             # Root task entrypoints
```

The calculator's business features live under
`apps/calculator/src/features/`; framework/integration code lives under
`apps/calculator/src/lib/`.

### Important architecture constraint

Server-side oRPC initialization must happen before SSR consumers use the client.
The locale layout (`apps/calculator/src/app/[locale]/layout.tsx`) must
side-effect-import `@/lib/orpc/client.server`, alongside the import in
`apps/calculator/src/instrumentation.ts`. If that import is missing, Server Components fall
back to the browser-only RPC link and existing project pages render as
spurious Next.js 404s — a regression diagnosed and fixed in August 2026. Do
not reorder these initialization imports. See `AGENTS.md`, the
[oRPC scoped instruction](docs/agents/instructions/orpc.md), and the
[official oRPC v1 SSR guide](https://v1.orpc.dev/docs/best-practices/optimize-ssr.md)
before changing this area.

---

## Getting started

### Prerequisites

Use the current project toolchain where possible:

- Node.js 22+ (Node.js 24 recommended) — enforced via `engines.node >= 22` in
  the root `package.json` and pinned to `22` in `.node-version`
- Corepack
- The pnpm version declared by root `package.json#packageManager`
- PostgreSQL

### Install

```bash
git clone https://github.com/henningsieh/greendex-calculator.git
cd greendex-calculator
corepack enable
pnpm install
```

### Configure the environment

Each application owns its local environment file:

```bash
cp apps/calculator/.env.example apps/calculator/.env
cp apps/documentation/.env.example apps/documentation/.env
```

Fill every required Calculator value in its example. The calculator validates
its variables with `@t3-oss/env-nextjs`; the development configuration includes:

- Application URLs and ports (`PORT` and `SOCKET_PORT`)
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- Google, GitHub, and Discord OAuth credentials
- SMTP connection credentials
- `NEXT_PUBLIC_SOCKET_URL`

Calculator scripts load its app-local file where needed; Next.js loads the
Documentation file. In Coolify, each application receives only its own values
from the platform, and those values remain outside Git.

### Prepare the database

Drizzle schemas and migrations live in `packages/database/`.

```bash
# Apply committed migrations
pnpm run db:migrate

# Optional: seed local development data
pnpm run db:seed

# Optional: inspect with Drizzle Studio
pnpm run db:studio
```

Generate schema/migration changes with:

```bash
pnpm run db:generate

# Regenerate Better Auth's schema when its model changes
pnpm --filter @greendex/calculator auth:generate
```

Do not manually edit generated Better Auth schema output unless the generation
workflow explicitly requires it.

### Run locally

```bash
pnpm run dev
```

The root Turbo task starts:

| Service           | Default URL/port        |
| ----------------- | ----------------------- |
| Calculator        | <http://localhost:3000> |
| Documentation app | <http://localhost:3001> |
| Socket.IO         | <http://localhost:4000> |

---

## Common commands

Run these from the repository root:

| Command                                            | Purpose                                       |
| -------------------------------------------------- | --------------------------------------------- |
| `pnpm run dev`                                     | Start all development tasks                   |
| `pnpm run build`                                   | Build all apps/packages                       |
| `pnpm run start`                                   | Start persistent workspace services           |
| `pnpm run type-check`                              | Run workspace type checks                     |
| `pnpm run lint`                                    | Run Oxlint and agent-instruction drift checks |
| `pnpm run format`                                  | Format workspaces with Oxfmt                  |
| `pnpm run check:agent-instructions`                | Validate scoped agent instructions            |
| `pnpm run test:run`                                | Run Vitest once                               |
| `pnpm --filter @greendex/calculator test:coverage` | Run calculator coverage                       |
| `pnpm run test:e2e`                                | Run Playwright tests                          |
| `pnpm run db:generate`                             | Generate Drizzle migrations                   |
| `pnpm run db:migrate`                              | Apply Drizzle migrations                      |
| `pnpm run db:seed`                                 | Seed local development data                   |

> **Deployment migration guarantee:** the calculator's `prestart` runs
> `pnpm --filter @greendex/database run db:migrate` before `start`. This uses
> the committed Drizzle migration history and the shell `&&` chain stops the
> application start if migration fails. A Coolify deployment therefore cannot
> make a new calculator container healthy with a database schema behind its
> shipped code. Before any local `pnpm run start`, verify that `DATABASE_URL`
> points at the database you intend to migrate.
>
> The calculator's `prebuild` only generates/checks Scalar SRI data.

---

## Application architecture

### Calculator routes and features

The calculator uses locale-prefixed App Router routes under
`apps/calculator/src/app/[locale]/`, including:

- Public landing, workshop, library, E-Forest, and educational pages
- Login, signup, verification, password reset, and OAuth flows
- Organization onboarding, dashboard, team, projects, archive, and settings
- Project details, Project Shared Travel Legs, participants, and live-view areas
- Public project participation/questionnaire routes

Feature modules cover authentication, organizations, projects, Project Shared
Travel Legs, participants, participation, landing pages, live view, and user
settings.

### API surfaces

| Endpoint             | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `/api/rpc`           | Internal oRPC endpoint used by the application |
| `/api/openapi`       | REST/OpenAPI endpoint for external consumers   |
| `/api/docs`          | Interactive Scalar API documentation           |
| `/api/openapi-spec`  | Generated OpenAPI JSON                         |
| `/api/rpc/health`    | Deployment health check                        |
| `/api/auth/[...all]` | Better Auth route                              |

Server Components call the server-side oRPC client directly; browser consumers
use the JSON-over-HTTP client and TanStack Query. See the
[implementation map](apps/calculator/src/lib/orpc/README.md),
[oRPC project rules](docs/agents/instructions/orpc.md), and
[official oRPC v1 index](https://v1.orpc.dev/llms.txt).

### Authentication and authorization

The app-specific Better Auth configuration is in:

```text
apps/calculator/src/lib/better-auth/index.ts
```

It provides:

- Email/password with mandatory verification
- Password reset and magic-link flows
- Google, GitHub, and Discord OAuth
- Organization membership and invitations
- Organization Administrator, Project Coordinator, and Participant access control (implemented with Better Auth roles)
- Active organization/project session fields

The database schema generated for Better Auth is stored in
`packages/database/src/schemas/auth-schema.ts`.

### Database and migrations

The database package exports the PostgreSQL/Drizzle client and combines auth,
Project, Project Participant, and Project Shared Travel Leg schemas. Migrations
are stored in:

```text
packages/database/src/migrations/
```

The canonical Project Shared Travel Leg table is
`project_shared_travel_leg`. Its `transport_emission_profile` column uses the
PostgreSQL enum `project_shared_transport_emission_profile`: `boat`, `bus`,
`train`, `car`, and `electricCar`. `plane` is valid only for non-persisted
Participant Travel Legs.

Migration `0010_enforce_project_shared_travel_legs.sql` is the historical
cutover migration. It preserves valid legacy rows while converting the old
`project_activity` table. Migration `0013_remove_project_activity_compatibility_view.sql`
removes the temporary legacy view after cutover. Do not edit applied migration
history; add a new migration for every schema change.

### Internationalization

Translations live in `packages/i18n/src/locales/` for:

- English (`en`)
- German (`de`)
- Spanish (`es`)
- Italian (`it`)
- French (`fr`)
- Dutch (`nl`)
- Slovenian (`si`)

The UI language menu is searchable by English language name, native label, and
locale code.

### Email

The repository contains a reusable `@greendex/email` workspace package and
calculator-specific email orchestration under
`apps/calculator/src/lib/email/`. Templates use the current `react-email`
package API; transport uses Nodemailer.

### Real-time proof of concept

`apps/calculator/src/socket-server.ts` is a separate Socket.IO process. It reads
validated process environment from `@/env`; Calculator scripts inject its
app-local `.env` through `dotenv-cli`, while Coolify injects runtime values
directly.

Clients connect through `NEXT_PUBLIC_SOCKET_URL`, so local ports and the deployed
socket hostname do not need URL-rewriting logic.

---

## Testing and quality

- Unit/integration tests: `apps/calculator/src/__tests__/`
- Feature tests: feature-local `__tests__/` directories
- End-to-end tests: `apps/calculator/src/__tests__/e2e/`
- Test runner: Vitest
- Browser runner: Playwright
- Lint/format: Oxlint and Oxfmt

Recent compatibility work strengthened OpenAPI/Scalar UI checks, project
statistics typing, invalid activity diagnostics, Next.js layout semantics, and
TanStack Table v9 behavior. A dedicated Playwright regression spec
(`src/__tests__/e2e/project-routing.spec.ts`) guards the SSR oRPC routing fix:
an authenticated user can open an existing internal project page, and a public
participation page loads for an existing project instead of returning 404.
The full Playwright suite (12 tests) is currently green when run against a
seeded local development server.

> **Current test-suite caveat:** `openapi-rest.test.ts` is an integration suite
> that expects the calculator server on `localhost:3000`. Its no-server skip
> path is not compatible with Vitest 4 yet. The remaining tests can be run with
> `pnpm --filter @greendex/calculator exec vitest run --exclude
src/__tests__/openapi-rest.test.ts`.

---

## Deployment

Greendex currently deploys only to a shared **Coolify development environment**:

- Calculator: <https://greendex.apps.sieh.org>
- Health check: `GET /api/rpc/health`
- App port: `3000`
- Socket port: `4000`, exposed through the configured public socket URL

There is intentionally **no repository Dockerfile**. The deployment relies on
Coolify injecting environment variables and Turborepo forwarding them to the
application processes. The `"env": ["*"]` setting on the `build` and `start`
tasks in [`turbo.json`](turbo.json) is critical for forwarding those variables
to workspace processes.

Every calculator deployment runs the existing Drizzle `db:migrate` command in
`prestart`, before Next.js and Socket.IO start. If a migration fails, the
process exits non-zero and Coolify cannot mark the new calculator container
healthy. This is the repository's database-as-code deployment contract.

Deployment secrets, database credentials, and infrastructure identifiers are
managed outside source control. Operational details for authorized maintainers
are documented in `AGENTS.md`.

---

## Documentation

Start with [`docs/README.md`](docs/README.md) for the developer-documentation
index. Agents can use [`docs/agents/agent-workflows.md`](docs/agents/agent-workflows.md) to
route cross-cutting tasks to the required scoped instructions and topic docs.
For each vendor integration, use the [online reference registry](docs/agents/integrations.md) with its linked Greendex map. Important project areas include:

- `docs/agents/instructions/orpc.md` — RPC/OpenAPI ownership and v1 routes
- `docs/agents/instructions/tanstack-query.md` and `tanstack-table.md` — Query and Table v9 rules
- `docs/agents/instructions/better-auth.md` — authentication and organizations
- `docs/agents/instructions/drizzle.md` and `coolify.md` — database and deployment boundaries
- `docs/agents/instructions/i18n.md` — locale and country handling
- `docs/participate/` — questionnaire and emissions flows
- `docs/projects/` — permissions and project behavior
- `docs/agents/instructions/email.md` — templates and transport
- `docs/agents/instructions/shadcn.md` — UI patterns
- `docs/agents/instructions/conventions.md` — linting and formatting

`PROJECT_STATE_REPORT.md` contains the detailed August 20–23 commit ledger,
current branch/PR state, deployment model, and remaining cleanup decisions.

---

## Known follow-ups

- Close or resolve stale PR #11, which targets an old Copilot branch.
- Remove merged/orphaned dependency branches after review.
- Decide whether to delete the old `bun-runtime` branch.
- Merge or further review open PR #57 (`migrate-email-to-package`), which
  centralizes transactional email in `@greendex/email`.
- Make the OpenAPI integration suite select/skip tests correctly when no server
  is running.
- Select and add a project license.

---

## Contributing

1. Create a focused branch from `main`.
2. Read `AGENTS.md` and the relevant topic docs.
3. Make the smallest coherent change.
4. Run formatting, linting, tests, and type checks appropriate to the change.
5. Review `git diff`, commit with a descriptive message, and open a PR.

Do not commit `.env`, OAuth credentials, SMTP passwords, database passwords, or
Coolify credentials.

## Maintainer

- **Henning Sieh** ([@henningsieh](https://github.com/henningsieh))

## License

No license has been selected yet.
