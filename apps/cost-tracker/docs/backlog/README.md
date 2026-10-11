# Backlog (low priority)

Manually curated, and linked from the [Cost Tracker documentation index](../README.md).

An item here is deferred work that still needs a decision or an implementation. It is **not** finished history — see [archive/](../archive/) for that.

## Needs a decision

- [Architecture review open questions](architecture-review-open-questions.md) — six questions deferred by the Phase 0–8 architecture review, including the definition of "recently closed" and the production volume budget.
- [Project/Partner cardinality](project-partner-cardinality.md) — can one Project have more than one Partner Organization, or is one Partner Organization per Project the real rule?

## Migrating to GitHub issues

`docs/agents/issue-tracker.md` states that issues and specs live as [GitHub issues](https://github.com/henningsieh/greendex-calculator/issues). This folder is the interim home. Migrate each item to an issue, then keep only a pointer here.

Items still tracked only in this folder:

- [E2E artifact privacy follow-up](e2e-artifact-privacy-followup.md) — non-blocking; not an MVP acceptance gate.
- [Error semantics follow-ups](error-semantics-followups.md) — wave 1 checklist, mostly closed.

## 1. `useSyncExternalStore` refactoring

- Context: `.oxlintrc.json` sets `react/set-state-in-effect` to `off` (was `warn`) as a temporary workaround for the vendored shadcn `useIsMobile` hook (`apps/calculator/src/hooks/use-mobile.ts`).
- When [shadcn-ui/ui#11603](https://github.com/shadcn-ui/ui/pull/11603) (fallback [#10433](https://github.com/shadcn-ui/ui/pull/10433)) is merged, sync the hook and flip the rule back to `warn`.
- See `docs/agents/instructions/shadcn.md` ("Temporary upstream divergence").

## 2. `mjs` -> `ts` refactoring for scripts

## 4. Refine submission validation and Oxlint safety defaults

- Context: `evaluateSubmission` in `apps/cost-tracker/src/features/projects/procedures/submission.ts:118` reports cyclomatic complexity 38 against `.oxlintrc.json`'s warning threshold of 25. It combines database loading, Participation/Journey checks, frozen funding-rule checks, Travel Cost Entry/allocation/proof validation, and payable calculation. The diagnostic concerns production code, not `submission.integration.test.ts`.
- Keep `complexity: ["warn", 25]` as an advisory signal; do not raise the global threshold or make it a hard architectural gate. Cyclomatic complexity counts branching constructs, including short-circuit expressions and optional chaining, rather than measuring readability directly.
- Extract cohesive Journey and allocation validation into pure, independently testable helpers, leaving `evaluateSubmission` as the coordinator. Preserve identical validation for preview and locked submission, issue paths/messages, and payable results. Avoid arbitrary helper extraction merely to lower the score; allow narrowly documented exceptions where keeping checks together is clearer.
- Add focused unit coverage for extracted validation and retain integration coverage for preview/submission behavior.
- Review the globally disabled `no-unsafe-optional-chaining` rule; enable it unless a concrete compatibility problem justifies a scoped exception.
- Change Cost Tracker's routine lint command to check-only or safe fixes. Reserve `--fix-suggestions --fix-dangerously` for explicitly requested cleanup runs rather than routine linting.
