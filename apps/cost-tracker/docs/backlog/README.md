# Backlog (low priority)

Manually curated. Not referenced from any index on purpose.

## 1. `useSyncExternalStore` refactoring

- Context: `.oxlintrc.json` sets `react/set-state-in-effect` to `off` (was `warn`) as a temporary workaround for the vendored shadcn `useIsMobile` hook (`apps/calculator/src/hooks/use-mobile.ts`).
- When [shadcn-ui/ui#11603](https://github.com/shadcn-ui/ui/pull/11603) (fallback [#10433](https://github.com/shadcn-ui/ui/pull/10433)) is merged, sync the hook and flip the rule back to `warn`.
- See `docs/agents/instructions/shadcn.md` ("Temporary upstream divergence").

## 2. `mjs` -> `ts` refactoring for scripts
