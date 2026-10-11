---
name: "oRPC"
description: "Procedures, middleware, router registration, OpenAPI, and SSR clients"
applyTo: "apps/calculator/src/lib/orpc/**/*.ts,apps/calculator/src/app/api/rpc/**/*.ts,apps/calculator/src/app/api/openapi/**/*.ts,apps/calculator/src/features/**/procedures.ts,apps/calculator/src/features/**/validation-schemas.ts,apps/calculator/src/instrumentation.ts,apps/calculator/src/app/**/page.tsx,apps/calculator/src/app/**/layout.tsx,apps/cost-tracker/src/lib/orpc/**/*.ts,apps/cost-tracker/src/app/api/rpc/**/*.ts,apps/cost-tracker/src/features/**/procedures/*.ts,apps/cost-tracker/src/features/**/*procedure*.ts,apps/cost-tracker/src/features/**/validation-schemas.ts,apps/cost-tracker/src/instrumentation.ts,apps/cost-tracker/src/app/**/page.tsx,apps/cost-tracker/src/app/**/layout.tsx"
---

# oRPC

## Online lookup

For every oRPC change:

1. Confirm both apps use the same installed `@orpc/*` v2 release via their manifests, `pnpm-workspace.yaml` catalog, and `pnpm-lock.yaml`.
2. Use the [oRPC v2 index](https://orpc.dev/llms.txt) for discovery. Begin with [getting started](https://orpc.dev/docs/getting-started.md) when orienting to the API.
3. Fetch only the Markdown pages for the active branch.
4. Compare examples with Greendex source and installed declarations; source and installed types win.
5. Finish when every changed oRPC concern has an authoritative source.

No official oRPC project skill is adopted. Use the versioned official pages and installed declarations. The [integration registry](../integrations.md#orpc) is only the aggregate navigation surface.

## Project sources of truth

| Concern | Location |
| --- | --- |
| Router | Owning app's `src/lib/orpc/router.ts` |
| Context and typed errors | Owning app's `src/lib/orpc/context.ts`; Cost Tracker's `error-contract.ts` and `errors.ts` |
| HTTP error statuses | Owning app's `src/lib/orpc/error-status.ts` |
| Authentication and permissions | Owning app's `src/lib/orpc/middleware.ts` |
| Shared procedures | Owning app's `src/lib/orpc/procedures.ts`, when present |
| Feature procedures | Owning app's `src/features/<feature>/procedures/` directory (one short-named file per procedure) or a single `procedures.ts` for small features |
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
2. Define Zod input/output schemas at the boundary and add `.meta(openapi({...}))` metadata imported from `@orpc/openapi` for REST/OpenAPI procedures.
3. Use `base` for public procedures and `authorized` for authenticated procedures; apply permission middleware after `authorized`.
4. Constrain tenant-owned persistence by `context.session.activeOrganizationId`.
5. Throw errors from the typed error map and test procedure and consumer behavior. Cost Tracker business outcomes use named methods from `src/lib/orpc/errors.ts`; their fixed code/reason and local copy live in `error-contract.ts`. HTTP statuses come from the app's `error-status.ts` map, not `ORPCError.status` or `.errors()` definitions. Do not construct free-form domain errors in producers or discriminate by remote prose in consumers. `error-centralization.test.ts` pins the matrix and guards construction sites; native Better Auth and exact private invariant exceptions remain separate.
6. Server Components call `orpc` directly or prefetch `orpcQuery.*.queryOptions()` into the request QueryClient.
7. Client Components use `orpcQuery` with TanStack Query; follow [TanStack Query project rules](tanstack-query.md).
8. Hydrate prefetched data before suspense consumers render, and handle typed navigation errors explicitly.
9. Keep internal Project reads authenticated and organization-scoped; Calculator uses `projects.getForParticipation` for public participation reads.

## OpenAPI

- Keep route metadata, schemas, handler prefixes, and the generated specification aligned. Metadata prefixes apply to every procedure; preserve the request-time `/api/rpc` and `/api/openapi` prefixes without doubling them.
- Internal traffic uses the oRPC wire protocol at `/api/rpc`; external REST/OpenAPI traffic uses `/api/openapi`.
- `OpenAPIReferenceHandlerPlugin` serves Scalar at `/api/docs`; `/api/openapi-spec` generates the JSON specification.
- Keep Scalar's `providerScriptUrl` pinned in the handler plugin. Generate specifications with `converters` and `base` options; import `ZodToJsonSchemaConverter` from `@orpc/zod`.
- Public route changes require OpenAPI tests and generated specification/Scalar checks.

## RPC and client compatibility

- `RPCLink` uses separate `origin` and `url` options; the RPC path is `/api/rpc`.
- Both RPC handlers allow GET plus `RPC_DEFAULT_ALLOW_METHODS` and use `GetMethodCsrfProtectionHandlerPlugin`; preserve the same-origin GET protection.
- Supply the app's `errorStatusMap` to HTTP handlers. Response status is the HTTP contract; error bodies carry code/message/data, not a status field.
- Use `RPCJsonSerializer` for query hashing/hydration, preserving the `{ json, meta }` payload; use `RPCSerializer` for the RPC wire protocol.
- `safe()` returns `[error, data, definedError, isSuccess]`; discriminate typed navigation errors with `definedError`.
- Server and browser client ship together from the same app build and locked release. Do not split rollout of the RPC wire format.

## Official v2 entry points

- Core: [getting started](https://orpc.dev/docs/getting-started.md), [procedures](https://orpc.dev/docs/procedure.md), [routers](https://orpc.dev/docs/router.md), [middleware](https://orpc.dev/docs/middleware.md), [context](https://orpc.dev/docs/context.md), [errors](https://orpc.dev/docs/error-handling.md)
- RPC: [protocol](https://orpc.dev/docs/rpc/protocol.md), [handler](https://orpc.dev/docs/rpc/handler.md), [link](https://orpc.dev/docs/rpc/link.md), [serializer](https://orpc.dev/docs/rpc/serializer.md), [GET CSRF protection](https://orpc.dev/docs/plugins/get-method-csrf-protection.md)
- Clients and SSR: [client-side](https://orpc.dev/docs/client/client-side.md), [server-side](https://orpc.dev/docs/client/server-side.md), [client errors and safe](https://orpc.dev/docs/client/error-handling.md), [Next.js](https://orpc.dev/docs/adapters/next.md), [optimized SSR](https://orpc.dev/docs/recipes/optimizing-ssr.md), [TanStack Query](https://orpc.dev/docs/integrations/tanstack-query.md)
- Contract-first: [overview](https://orpc.dev/docs/contract-first.md), [procedure](https://orpc.dev/docs/contract/procedure.md), [router](https://orpc.dev/docs/contract/router.md), [implementation](https://orpc.dev/docs/contract/implementation.md), [OpenAPI to contract](https://orpc.dev/docs/contract/generate-from-openapi.md)
- OpenAPI: [routing](https://orpc.dev/docs/openapi/routing.md), [input/output mapping](https://orpc.dev/docs/openapi/input-and-output-mapping.md), [handler](https://orpc.dev/docs/openapi/handler.md), [specification](https://orpc.dev/docs/openapi/specification.md), [reference plugin](https://orpc.dev/docs/plugins/openapi-reference.md), [smart coercion](https://orpc.dev/docs/plugins/smart-coercion.md), [link](https://orpc.dev/docs/openapi/link.md), [Zod](https://orpc.dev/docs/integrations/zod.md)
- Middleware and authentication: [CORS](https://orpc.dev/docs/plugins/cors.md), [response headers](https://orpc.dev/docs/plugins/response-headers.md), [dedupe middleware](https://orpc.dev/docs/recipes/dedupe-middleware.md), [Better Auth](https://orpc.dev/docs/integrations/better-auth.md)
