---
name: "Architecture"
description: "Monorepo boundaries, Next.js layers, and critical SSR initialization"
applyTo: "apps/*/src/**/*.ts,apps/*/src/**/*.tsx,packages/*/src/**/*.ts,packages/*/src/**/*.tsx"
---

# Architecture

Use this instruction when placing code, crossing workspace boundaries, or changing server/client data flow. Read [`docs/README.md`](../../README.md) and the topic-specific documentation before changing an integration.

## Workspace boundaries

| Area              | Source of truth           | Responsibility                                                                |
| ----------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Calculator app    | `apps/calculator/src/`    | Carbon-footprint routes, features, adapters, Better Auth wiring, Socket.IO     |
| Cost Tracker app  | `apps/cost-tracker/src/`  | Journey-cost routes and Cost Tracker-owned behavior                            |
| Documentation app | `apps/documentation/src/` | Fumadocs application                                                          |
| Auth package      | `packages/auth/src/`      | Shared Better Auth client types and utilities                                 |
| Config package    | `packages/config/src/`    | Shared domain and locale configuration                                        |
| Database package  | `packages/database/src/`  | Drizzle client, schemas, migrations                                           |
| Email package     | `packages/email/src/`     | Transactional templates, rendering, delivery primitives                       |
| i18n package      | `packages/i18n/src/`      | next-intl exports and locale messages                                         |

Keep environment-specific integration in the consuming app. For example, `apps/calculator/src/lib/email.ts` injects SMTP and application URL configuration into `@greendex/email`. Follow the [Cost Tracker architecture](../../../apps/cost-tracker/docs/architecture.md) when placing Cost Tracker routes, shared UI, features, validation schemas, and integration seams.

## Application layers

- Routes and layouts: `apps/<app>/src/app/`
- Feature behavior: `apps/<app>/src/features/<feature>/`
- Shared app components: `apps/<app>/src/components/`
- Integration libraries: `apps/<app>/src/lib/`

Add business behavior to the owning application's feature. Procedures are registered in the owning app's `src/lib/orpc/router.ts`. Keep Project Partnerships and Cost Submissions in Cost Tracker; share only the agreed Organization, Project, Project Participation, persistence, and transport interfaces. Put reusable cross-app behavior in a workspace package only when it has a clear package-level interface.

Application runtime database access belongs in owning feature procedures. Route and view modules consume oRPC interfaces; integration-test fixtures, Better Auth integration, and schema-derived validation remain their own seams.

## Critical SSR oRPC invariant

Preserve the owning app's server-client initialization order: its `instrumentation.ts` dynamically imports `@/lib/orpc/client.server` in the Node.js runtime, and its root app layout side-effect-imports that client before local SSR consumers. The [oRPC instruction](orpc.md) owns the full invariant. Read it and the [official v1 SSR guide](https://v1.orpc.dev/docs/best-practices/optimize-ssr.md) before editing this seam, then run its app-local SSR regression coverage.

## Server and client data flow

- Server Components call `orpc` directly or prefetch `orpcQuery` query options into the request query client.
- Client Components use `orpcQuery` with TanStack Query and `orpc` for mutations.
- Prefer Server Components. Add `"use client"` only for hooks, browser APIs, or interaction.
- Pass request-specific headers through the server oRPC context; do not store request data in global reusable context.
- Internal RPC traffic enters through the owning app's `src/app/api/rpc/`; Calculator public REST/OpenAPI traffic enters through `apps/calculator/src/app/api/openapi/`.

## Placement guide

| Change                                      | Location                                                      |
| ------------------------------------------- | ------------------------------------------------------------- |
| Project or organization procedure           | Owning `apps/<app>/src/features/<feature>/procedures.ts` |
| Procedure registration or shared middleware | Owning `apps/<app>/src/lib/orpc/`                       |
| Database schema or migration                | `packages/database/src/`                                  |
| Transactional email template                | `packages/email/src/templates/`                           |
| Email transport configuration               | `apps/calculator/src/lib/email.ts`                        |
| Translation message                         | Every file in `packages/i18n/src/locales/`                |
| Shared UI primitive                         | Owning `apps/<app>/src/components/ui/`                    |
| Feature UI                                  | Owning `apps/<app>/src/features/<feature>/components/`   |

## Constraints

- Workspace modules are ESM.
- Read validated environment values from `apps/calculator/src/env.ts`; direct `process.env` access is limited to that file and `apps/calculator/src/instrumentation.ts`.
- Preserve React Compiler configuration in `apps/calculator/next.config.ts`.
- Socket.IO remains a separate process in `apps/calculator/src/socket-server.ts`.
- Import app modules through `@/` and workspace modules through `@greendex/*`; avoid new app-level barrel files.
