# Backlog (low priority)

Manually curated. Not referenced from any index on purpose.

## 1. `useSyncExternalStore` refactoring

- Context: `.oxlintrc.json` sets `react/set-state-in-effect` to `off` (was `warn`) as a temporary workaround for the vendored shadcn `useIsMobile` hook (`apps/calculator/src/hooks/use-mobile.ts`).
- When [shadcn-ui/ui#11603](https://github.com/shadcn-ui/ui/pull/11603) (fallback [#10433](https://github.com/shadcn-ui/ui/pull/10433)) is merged, sync the hook and flip the rule back to `warn`.
- See `docs/agents/instructions/shadcn.md` ("Temporary upstream divergence").

## 2. `mjs` -> `ts` refactoring for scripts

## 3. Rename Calculator `ProjectCoordinator` role key

- Context: `apps/calculator/src/features/organizations/types.ts` maps `ProjectCoordinator: "admin"` (legacy: Calculator coordinators were stored as Organization admins). Cost Tracker separately defines an assignment-scoped `project-coordinator` role (one explicit Project/Partnership assignment, no Organization-wide authority). Same word, two meanings across apps sharing one membership table — already misled a tester into reading a coordinator as an admin.
- Todo: pick an unambiguous Calculator key (e.g. `ProjectLead` or scope-explicit naming), migrate stored `"admin"` rows that actually mean coordinator (see `docs/projects/permissions.md` migration notes), update Calculator UI copy, and keep Cost Tracker's `project-coordinator` untouched.
- Comment marker placed at the mapping; do not "fix" by aliasing the Cost Tracker role.
