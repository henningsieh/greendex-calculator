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

## Current feature ownership

User appearance and account-name behavior belong to `src/features/user-settings/`. The protected route composes that feature at `src/app/(protected)/user-settings/page.tsx`; shared navigation and theme-provider mechanics remain in `src/components/`.

See [User settings](user-settings.md) for the feature's behavior and integration details.
