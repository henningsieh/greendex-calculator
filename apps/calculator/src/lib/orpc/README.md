# oRPC Implementation Map

Greendex exposes one router through two protocol surfaces and two documentation endpoints.

## Endpoints

| Endpoint            | Owner                                  | Purpose                                       |
| ------------------- | -------------------------------------- | --------------------------------------------- |
| `/api/rpc`          | `app/api/rpc/[[...rest]]/route.ts`     | Internal JSON-over-HTTP RPC used by `RPCLink` |
| `/api/openapi`      | `app/api/openapi/[[...rest]]/route.ts` | External REST/OpenAPI requests                |
| `/api/docs`         | `app/api/docs/route.ts`                | Scalar API reference                          |
| `/api/openapi-spec` | `app/api/openapi-spec/route.ts`        | Generated OpenAPI JSON                        |

## Source ownership

| Concern                                  | Source                                   |
| ---------------------------------------- | ---------------------------------------- |
| Context and typed errors                 | `context.ts`                             |
| Authentication and permission middleware | `middleware.ts`                          |
| Shared procedures                        | `procedures.ts`                          |
| Feature procedures                       | `../../features/<feature>/procedures.ts` |
| Router registration                      | `router.ts`                              |
| Direct server client                     | `client.server.ts`                       |
| Universal client and Query utilities     | `orpc.ts`                                |
| OpenAPI/Scalar configuration             | `openapi-handler.ts`                     |

`instrumentation.ts` and `app/[locale]/layout.tsx` must initialize `client.server.ts` before server consumers evaluate `orpc.ts`. The server client resolves request headers inside its context function.

## Current imports

- Consumers import `orpc` or `orpcQuery` from `@/lib/orpc/orpc`.
- Procedure files import `base` from `@/lib/orpc/context` and authenticated or permission middleware from `@/lib/orpc/middleware`.
- Router and context types come from their owning modules; there is no `@/lib/orpc` barrel.
- `@/lib/orpc/client.server` creates the direct in-process server client and is imported for server-only initialization; consumers import `orpc` from `@/lib/orpc/orpc`, which uses that initialized client during SSR.

## Further guidance

- [Greendex oRPC rules](../../../../../docs/agents/instructions/orpc.md)
- [Official oRPC v1 documentation index](https://v1.orpc.dev/llms.txt)
