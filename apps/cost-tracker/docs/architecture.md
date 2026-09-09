# Cost Tracker architecture

Cost Tracker keeps route composition separate from feature behavior.

## Source layout

```text
src/
├── app/                              # Next.js routes and layouts
├── components/                       # application shell and shared UI
├── features/<feature>/
│   ├── components/                   # feature-owned UI
│   ├── providers/                    # RSC-safe context boundaries, when needed
│   ├── hooks/                        # feature-owned client/query hooks, when needed
│   ├── validation-schemas.ts         # Drizzle-derived Zod schemas
│   ├── types.ts                      # types inferred from schemas or Drizzle
│   └── utils.ts                      # pure feature utilities, when needed
└── lib/                              # application integration seams
```

Create only the subdirectories a feature uses; do not add empty architecture placeholders. Keep route files focused on authorization, server data loading, metadata, and feature composition. Shared application-shell components belong in `src/components/`; behavior used by one feature belongs under that feature.

## Persistence seam

Runtime route and view modules consume oRPC interfaces. Feature procedures own application database-client access, including authorization, active Organization scoping, persistence, and DTO projection. Integration-test fixtures, Better Auth integration, and schema-derived validation are separate seams. Run `pnpm run check:cost-tracker-persistence-seam` after changing Cost Tracker routes or view components.

## Validation and types

Persisted form schemas start from the owning Drizzle table with `drizzle-zod`, then narrow and refine that schema for the user-editable payload. Infer types from schemas or Drizzle instead of duplicating persistence shapes by hand. Keep schemas usable by both server and client modules unless they intentionally depend on a server-only integration.

## Project read architecture

`/projects` is the canonical Project collection. Its Server Component parses the shared nuqs contract, resolves the available Hosted/Partner scope through oRPC, and prefetches exactly one generated overview query. The hydrated client view keeps scope, filters, sort, cursor, and page size in shallow URL state; TanStack Query requests each authoritative page and TanStack Table renders that page without client filtering, sorting, or pagination.

`/projects/[id]` accepts only Project identity. `project-relationship.server.ts` derives Hosted, Partner, or inaccessible access from the active Organization, and the detail procedure projects relationship-specific safe data. URL scope is never authorization input.

`/partner-organizations` owns Hosting-side Project Partnership management. Procedures validate Better Auth actions, prove Hosting ownership, and preserve represented-Organization invariants. Existing Organization discovery remains deliberately limited to exact known IDs until a directory disclosure policy is approved.

The pre-release `/dashboard` route is intentionally absent. Authentication, brand, and Organization-recovery destinations use `/projects`.

## Current feature ownership

Project collection state, relationship policy, reads, Project Partnership mutations, and views belong to `src/features/projects/`. User appearance and account-name behavior belong to `src/features/user-settings/`. Protected routes compose those features; shared navigation and provider mechanics remain in `src/components/`.

See [Cost Tracker Projects](projects/README.md) and [User settings](user-settings.md) for behavior and integration details.
