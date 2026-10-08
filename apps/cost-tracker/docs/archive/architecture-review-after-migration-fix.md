# Standards report — 13 findings

> Historical snapshot of the Standards review for `1257069..4903da2`, produced on 2026-09-09. The findings describe that reviewed state, not the current branch. See [the final migration review](architecture-migration-final-review.md) for each current disposition.

1. **Hard — migration history changed.** `packages/database/src/migrations/0015_project_partnership_foundation.sql:15-122` adds backfill/triggers to migration `0015`, which already exists in the base and journal. Previously migrated databases will never execute these additions. Violates `docs/agents/instructions/drizzle.md#Greendex workflow` (“Never hand-edit … applied migrations”) and `conventions.md#Database changes`.

2. **Hard — tenant scoping is not atomic.** `project-partnership-procedures.ts:143-150,190-193` reads/deletes by partnership ID alone; `project-detail-procedure.ts:82-99` reads partner organizations by Project ID alone after a separate authorization query. Violates `code-standards.md#Procedures and persistence`: constrain Organization-owned queries by `activeOrganizationId`.

3. **Hard — persistence outside procedures.** `project-relationship.server.ts` imports `db` and executes the relationship query. `architecture.md#Application layers`, `code-standards.md#Procedures and persistence`, and `apps/cost-tracker/docs/architecture.md#Persistence seam` assign runtime database-client access to feature procedures.

4. **Hard — typed errors are swallowed.** `projects/page.tsx:32-35` uses `.catch(() => ({ hosted: true, partner: false }))`, converting `UNAUTHORIZED`, `FORBIDDEN`, and unexpected failures into fabricated scope data. Violates `code-standards.md#Async and errors` and `orpc.md#Procedures and consumers`.

5. **Hard — production failures are not logged.** `hydration.tsx:19-21` logs swallowed prefetch failures only outside production. Violates `code-standards.md#Async and errors`.

6. **Hard — unlabeled controls.** `project-collection.tsx:246-303` has three `<Label>`/`<SelectTrigger>` pairs without `htmlFor`, ID, or equivalent accessible name. Violates `shadcn.md#Accessibility` and `code-standards.md#React and Next.js`.

7. **Hard — unstable list key.** `project-collection.tsx:422` uses `<TableRow key={row.id}>` without configuring `getRowId`; Table’s default row ID is positional. Violates `code-standards.md#React and Next.js` (“stable domain identifiers”).

8. **Hard — duplicated handwritten boundary types.** `ProjectRow` and `CommonOverviewInput` duplicate `ProjectOverviewRowSchema` and overview input schemas. Violates `code-standards.md#TypeScript boundaries`.

9. **Hard — unchecked assertions.** Examples include `project-overview-query-options.ts:38` (`as unknown as`), Select value casts, SQL `)!`, and `activeOrganizationId!` across overview/partnership procedures. Violates `code-standards.md#TypeScript boundaries`.

10. **Hard — persisted form schema not Drizzle-derived.** `validation-schemas.ts:140-143` defines assignment input with `z.object(...)`. Violates `apps/cost-tracker/docs/architecture.md#Validation and types`.

11. **Hard — mutation failures are hidden.** `use-sign-out.ts:16-19` silently returns; `no-organization-access.tsx:42-54` does not handle rejected requests. Violates `code-standards.md#Async and errors` and `shadcn.md#Forms`.

12. **Hard — shared versions bypass the catalog.** `apps/cost-tracker/package.json` repeats numeric oRPC, TanStack, nuqs, and react-error-boundary versions already used by Calculator. Violates `workspace.md#Dependency ownership`.

13. **Judgement — Duplicated Code / Repeated Switches.** `overview-procedures.ts` repeats hosted/partner pagination (`“const rows = pageRows.slice…”`, cursor construction, metrics mapping) and switches on `input.sort` in both `getProjectOrder` and `getCursorFilter`. Adding a sort requires coordinated edits. Also, commits `7f880c2`, `21e00b7`, `3e38c91`, `c9d269a`, `d91b6f1`, `29502bb`, `2b021e5`, and `4903da2` violate `AGENTS.md#Commit Conventions`.
