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
- Declare Zod schemas in the owning feature's `validation-schemas.ts`, derived from the database tables through `createSelectSchema`, `createInsertSchema`, or a shared `<X>IdSchema`. Components import them; when messages are translated, export a `create…Schema(t)` factory instead of building the schema inline. `greendex-domain/validation-schema-location` rejects component-local schemas.
- Model optional form values consistently across the schema, default values, and UI controls.
- Name constants for protocol limits, validation bounds, and domain coefficients.
- Keep workspace public APIs behind declared package exports; use `@greendex/*` imports across workspaces.

## Imports and environment

- Let Oxfmt sort imports. Preserve side-effect imports and the oRPC initialization invariant described in `docs/agents/instructions/architecture.md`.
- Use `@/` for application-local imports rather than relative parent traversal.
- Read runtime configuration through the owning app's `src/env.ts`; follow its documented exceptions for instrumentation.
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
- Consult the version-matched docs bundled with the installed package at `node_modules/next/dist/docs/` before changing Next.js behavior.

## Procedures and persistence

- Validate procedure input with Zod before reaching persistence code.
- Authorize access at the procedure boundary and constrain organization-owned database queries by `activeOrganizationId`.
- Put procedures in their owning feature and register them in the owning app's `src/lib/orpc/router.ts`.
- Keep application runtime database-client access in feature procedures. Route and view modules consume oRPC; integration-test fixtures, Better Auth integration, and schema-derived validation are separate allowed seams.
- Keep database schemas and migrations in `packages/database/`.

## State machines

Use a state machine when a named event changes a workflow and the current state determines whether that event is allowed. Apply this pattern to domain lifecycles and UI workflows alike. Derive labels, badges, and read-only statuses from existing facts instead of giving them their own machines. In Cost Tracker, for example, Project archive/reopen changes stored state; settlement readiness is derived from Claims ([ADR-0027](../../adr/0027-archive-settled-cost-tracker-projects.md)).

1. **Define transitions once.** Keep a typed transition table in the owning feature. A pure function takes the current state, a named event, and any facts required by the transition. It returns the next state or an explicit, typed refusal. Derive state-based action availability from the same definition. Start with plain TypeScript; extract a shared helper only when implementations show real duplication.
2. **Run effects outside the machine.** For domain transitions, the server authorizes the action, reads authoritative state, and applies the change and any history in the same transaction with the required locks. The UI may use the shared policy to guide presentation, but never overrides server enforcement ([ADR-0014](../../adr/0014-declare-permissions-once-and-evaluate-them-on-the-server.md)). UI machines own interaction state only; their controllers run requests and other effects without duplicating persisted domain status.
3. **Show each actionable error once.** Use React Hook Form field errors for problems the user can fix in a specific field; use the app's error toast for other action failures. Keep the dialog and entered values on failure. Keep localized feedback outside the transition function. An intentionally ignored event, such as a second click while saving, does not need a toast.
4. **Generate and check the diagram.** Generate a Mermaid state diagram from each machine's transition definition and commit it in the owning app's behavior docs under `docs/`. Include named actions and important user-facing prerequisites; omit implementation details such as locks. Use an automated drift check to reject stale diagrams. User documentation must follow the generated workflow without copying technical detail. Use ADRs for the reasoning, not a second hand-maintained diagram.
5. **Test both outcomes.** Test valid transitions, invalid events, and guard refusals. Cover server enforcement at the procedure boundary and, for UI machines, the appropriate error placement and preserved input.

Use the Cost Tracker Claim lifecycle and its payment dialog as the first domain and UI reference implementations, respectively.

## Tests

Follow the authoritative [two-loop testing policy](conventions.md#two-verification-loops) for focused selection, dev/MCP runtime checks, production-only exceptions, and coordinator-owned final acceptance. Report selected checks and rationale, runtime mode/target, evidence, and blockers. Shared-boundary changes require broader affected coverage, not an unrelated full suite per implementer.

- Add regression coverage for bug fixes at the lowest level that reproduces the failure.
- Use Vitest for units/integrations and Playwright for browser-visible routing and interaction.
- Keep tests isolated and deterministic; clean up rows created by integration/E2E fixtures.
- Do not commit `.only()` or unconditional `.skip()` calls.
- Assert observable behavior and error contracts rather than implementation trivia.
- For SSR routing changes, run the owning app's SSR regression coverage; Calculator uses `apps/calculator/src/__tests__/e2e/project-routing.spec.ts`.

## Documentation

Document reasons and invariants that are not obvious from configuration. Avoid copying package versions, directory listings, or APIs that can be read directly from the source of truth.

References:

- [Official Oxc index](https://oxc.rs/llms.txt)
- [Calculator participation testing](../../../apps/calculator/docs/participate/testing.md)
- [Architecture instructions](architecture.md)
