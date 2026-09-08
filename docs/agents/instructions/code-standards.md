---
name: "Code Standards"
description: "Repository-specific TypeScript, React, error-handling, and test standards"
applyTo: "apps/*/src/**/*.ts,apps/*/src/**/*.tsx,apps/*/src/**/*.js,apps/*/src/**/*.jsx,packages/*/src/**/*.ts,packages/*/src/**/*.tsx,packages/*/src/**/*.js,packages/*/src/**/*.jsx,scripts/**/*.js,scripts/**/*.mjs"
---

# Code Standards

Oxfmt and Oxlint enforce mechanical style. This file records decisions tooling cannot reliably infer.

## TypeScript boundaries

- Preserve inference inside implementations; add explicit types at exported APIs and integration boundaries when they clarify the contract.
- Use `unknown` and narrow it instead of introducing `any` or unchecked assertions.
- Reuse domain schemas and inferred types. Do not duplicate a Zod schema as a handwritten interface.
- Model optional form values consistently across the schema, default values, and UI controls.
- Name constants for protocol limits, validation bounds, and domain coefficients.
- Keep workspace public APIs behind declared package exports; use `@greendex/*` imports across workspaces.

## Imports and environment

- Let Oxfmt sort imports. Preserve side-effect imports and the oRPC initialization invariant described in `docs/agents/instructions/architecture.md`.
- Use `@/` for calculator app imports rather than relative parent traversal.
- Read runtime configuration through `apps/calculator/src/env.ts`. Source files must not access `process.env` directly except `apps/calculator/src/env.ts` and `apps/calculator/src/instrumentation.ts`.
- Keep modules ESM.

## Async and errors

- Await operations whose completion affects control flow, persistence, navigation, or cleanup.
- Run independent operations concurrently; keep dependent operations sequential.
- Preserve typed oRPC errors (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`) instead of converting them to generic errors.
- Log unexpected server failures with useful context. Avoid swallowing failures or catching only to rethrow unchanged.
- Return user-safe messages to clients; do not expose credentials, tokens, connection strings, or internal stack details.

## React and Next.js

- Prefer Server Components. Introduce `"use client"` only for interaction, hooks, or browser APIs.
- Keep Client Component boundaries narrow; pass serializable data across the boundary.
- Use semantic controls and accessible names. Every form control requires a label or equivalent accessible name.
- Use stable domain identifiers as list keys.
- Keep components at module scope rather than defining them during render.
- Use localized navigation and messages in locale-prefixed calculator routes.
- Consult the checked-in `.next-docs` pages listed in `AGENTS.md` before changing Next.js behavior.

## Procedures and persistence

- Validate procedure input with Zod before reaching persistence code.
- Authorize access at the procedure boundary and constrain organization-owned database queries by `activeOrganizationId`.
- Put procedures in their owning feature and register them in `apps/calculator/src/lib/orpc/router.ts`.
- Keep database schemas and migrations in `packages/database/`.

## Tests

- Add regression coverage for bug fixes at the lowest level that reproduces the failure.
- Use Vitest for units/integrations and Playwright for browser-visible routing and interaction.
- Keep tests isolated and deterministic; clean up rows created by integration/E2E fixtures.
- Do not commit `.only()` or unconditional `.skip()` calls.
- Assert observable behavior and error contracts rather than implementation trivia.
- For SSR routing changes, run `apps/calculator/src/__tests__/e2e/project-routing.spec.ts`.

## Documentation

Document reasons and invariants that are not obvious from configuration. Avoid copying package versions, directory listings, or APIs that can be read directly from the source of truth.

References:

- [Official Oxc index](https://oxc.rs/llms.txt)
- [`docs/participate/testing.md`](../../participate/testing.md)
- [Architecture instructions](architecture.md)
