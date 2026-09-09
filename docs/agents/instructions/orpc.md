---
name: "oRPC"
description: "Procedures, middleware, router registration, OpenAPI, and SSR clients"
applyTo: "apps/calculator/src/lib/orpc/**/*.ts,apps/calculator/src/app/api/rpc/**/*.ts,apps/calculator/src/app/api/openapi/**/*.ts,apps/calculator/src/features/**/procedures.ts,apps/calculator/src/features/**/validation-schemas.ts,apps/calculator/src/instrumentation.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/cost-tracker/src/lib/orpc/**/*.ts,apps/cost-tracker/src/app/api/rpc/**/*.ts,apps/cost-tracker/src/features/**/*procedure*.ts,apps/cost-tracker/src/features/**/validation-schemas.ts,apps/cost-tracker/src/instrumentation.ts,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx"
---

# oRPC

## Online lookup

For every oRPC change:

1. Confirm the installed `@orpc/*` major in `apps/calculator/package.json` and `pnpm-lock.yaml`.
2. Use the [oRPC product index](https://orpc.dev/llms.txt) for discovery and the [oRPC v1 index](https://v1.orpc.dev/llms.txt) for installed-major guidance. Begin with the direct [v1 getting-started page](https://v1.orpc.dev/docs/getting-started.md) when orienting to the API.
3. Fetch only the Markdown pages for the active branch.
4. Compare examples with Greendex source and installed declarations; source and installed types win.
5. Finish when every changed oRPC concern has an authoritative source.

No official oRPC project skill is adopted. Use the versioned official pages and installed declarations. The [integration registry](../integrations.md#orpc) is only the aggregate navigation surface.

## Project sources of truth

| Concern | Location |
| --- | --- |
| Router | Owning app's `src/lib/orpc/router.ts` |
| Context and typed errors | Owning app's `src/lib/orpc/context.ts` |
| Authentication and permissions | Owning app's `src/lib/orpc/middleware.ts` |
| Shared procedures | Owning app's `src/lib/orpc/procedures.ts`, when present |
| Feature procedures | Owning app's `src/features/<feature>/procedures.ts` |
| Direct server client | Owning app's `src/lib/orpc/client.server.ts` |
| Universal client and Query utilities | Owning app's `src/lib/orpc/orpc.ts` |
| OpenAPI configuration | Calculator's `src/lib/orpc/openapi-handler.ts` |
| RPC route | Owning app's `src/app/api/rpc/[[...rest]]/route.ts` |
| REST/OpenAPI route | `apps/calculator/src/app/api/openapi/[[...rest]]/route.ts` |
| Scalar route | `apps/calculator/src/app/api/docs/route.ts` |
| OpenAPI specification | `apps/calculator/src/app/api/openapi-spec/route.ts` |

## Critical SSR invariant

The direct router client must exist before the owning app's `src/lib/orpc/orpc.ts` evaluates on the server.

- The owning app's `instrumentation.ts` dynamically imports `@/lib/orpc/client.server` in the Node runtime.
- Its root app layout side-effect-imports `@/lib/orpc/client.server` before local SSR consumers.
- `client.server.ts` resolves `headers()` inside its context function so request data remains request-specific.
- Preserve both initialization paths and their effective order. Validate this seam with app-local SSR regression coverage.

## Procedures and consumers

1. Put domain procedures in the owning feature and register them in the owning app's `src/lib/orpc/router.ts`.
2. Define Zod input/output schemas at the boundary and add `.route(...)` metadata for REST/OpenAPI procedures.
3. Use `base` for public procedures and `authorized` for authenticated procedures; apply permission middleware after `authorized`.
4. Constrain tenant-owned persistence by `context.session.activeOrganizationId`.
5. Throw errors from the typed error map and test procedure and consumer behavior.
6. Server Components call `orpc` directly or prefetch `orpcQuery.*.queryOptions()` into the request QueryClient.
7. Client Components use `orpcQuery` with TanStack Query; follow [TanStack Query project rules](tanstack-query.md).
8. Hydrate prefetched data before suspense consumers render, and handle typed navigation errors explicitly.
9. Keep internal Project reads authenticated and organization-scoped; Calculator uses `projects.getForParticipation` for public participation reads.

## OpenAPI

- Keep route metadata, schemas, handler prefixes, and the generated specification aligned.
- Internal traffic uses the JSON-over-HTTP RPC protocol at `/api/rpc`; external REST/OpenAPI traffic uses `/api/openapi`.
- `OpenAPIReferencePlugin` serves Scalar at `/api/docs`; `/api/openapi-spec` generates the JSON specification.
- Treat `apps/calculator/scripts/generate-sri.js`, `apps/calculator/scripts/check-sri.js`, and `apps/calculator/package.json#config.scalarVersion` as the sources for Scalar SRI behavior.
- Public route changes require OpenAPI tests and generated specification/Scalar checks.

## Official v1 entry points

- Core: [getting started](https://v1.orpc.dev/docs/getting-started.md), [procedures](https://v1.orpc.dev/docs/procedure.md), [routers](https://v1.orpc.dev/docs/router.md), [middleware](https://v1.orpc.dev/docs/middleware.md), [context](https://v1.orpc.dev/docs/context.md), [errors](https://v1.orpc.dev/docs/error-handling.md)
- Clients and SSR: [client-side](https://v1.orpc.dev/docs/client/client-side.md), [server-side](https://v1.orpc.dev/docs/client/server-side.md), [Next.js](https://v1.orpc.dev/docs/adapters/next.md), [optimized SSR](https://v1.orpc.dev/docs/best-practices/optimize-ssr.md), [TanStack Query](https://v1.orpc.dev/docs/integrations/tanstack-query.md)
- Contract-first: [define](https://v1.orpc.dev/docs/contract-first/define-contract.md), [implement](https://v1.orpc.dev/docs/contract-first/implement-contract.md), [router to contract](https://v1.orpc.dev/docs/contract-first/router-to-contract.md), [OpenAPI to contract](https://v1.orpc.dev/docs/openapi/openapi-to-contract.md)
- OpenAPI: [getting started](https://v1.orpc.dev/docs/openapi/getting-started.md), [handler](https://v1.orpc.dev/docs/openapi/openapi-handler.md), [routing](https://v1.orpc.dev/docs/openapi/routing.md), [reference plugin](https://v1.orpc.dev/docs/openapi/plugins/openapi-reference.md), [smart coercion](https://v1.orpc.dev/docs/openapi/plugins/smart-coercion.md), [OpenAPI link](https://v1.orpc.dev/docs/openapi/client/openapi-link.md)
- Authentication: [Better Auth integration](https://v1.orpc.dev/docs/integrations/better-auth.md)
