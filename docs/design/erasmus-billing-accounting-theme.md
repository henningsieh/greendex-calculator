# Erasmus Re-theme: Billing & Accounting (Cost Tracker)

**Status:** in progress — Session 1 done, Session 2 ready to fire.
**Branch:** `design/erasmus-billing-accounting-theme` (based off `origin/chore/add-cost-tracker-app` @ `469a0a23`).
> Earlier the branch was cut from the wrong base (`refactor/cost-tracker-participant-and-claim-model` @ `5d9244ef`); re-created on the correct base 2026-10-05. No commits were made on the wrong base, only the untracked track file, which carried over.
**Scope:** Cost Tracker Billing/Accounting surfaces — `Claim`, `Travel Cost Entry`, `Cost Allocation`, `Payout Account`, `Proof Document` ([cost-tracker glossary](../../apps/cost-tracker/GLOSSARY.md), [shared language](../../GLOSSARY.md)).

App-owned behavior details stay in `apps/cost-tracker/docs/`; this file tracks the redesign chain only.

## Anchors (Session 0 brief)

- EU/Erasmus signal colors only: EU blue `#003399` + EU yellow `#FFCC00`; deep blue trust surfaces, white dense tables.
- Animation budget LOW: billing/accounting actions run tens-to-100x/day → feedback-only (button press `scale(0.97)`, toasts), no entrances/stagger/springs on data. `prefers-reduced-motion` respected.
- Canonical glossary terms are not renamed by the redesign.
- Guardrails: `shadcn/no-restyle` (variants/contracts first), no `pnpm run dev`, one writer per worktree, commits only with permission.

## Skill chain

1. `frontend-design` first — identity: tokens, type, layout, what is memorable. Plan → review → build.
2. `emil-design-eng` second — feel: easing, durations, unseen details. Review in `| Before | After | Why |` table.

## Session log

| #   | Session              | State   | Notes                                                                                       |
| --- | -------------------- | ------- | ------------------------------------------------------------------------------------------- |
| 0   | Brief alignment      | done    | Anchors above; epic issue still to file                                                     |
| P   | Preflight            | done    | 13 agents executable; quota 5h 88% (reset 21:00 CEST), weekly 24% — above 15% gate          |
| 1   | Scout audit          | done    | Handoff logged below; start-here: `claim-workspace.tsx`; risks: pink primary token, no-restyle, table density, IBAN narrow, states |
| 2   | Theme plan (no code) | pending | `frontend-design`, plan-only → `artifacts/erasmus-theme-plan.md`; human gate on tokens/wires |
| 3   | Flagship build       | pending | 2 screens (Claim detail + Cost Entries table), one writer                                   |
| 4   | Emil polish          | pending | Restrained pass, feedback-only motion                                                       |
| 5   | Rollout + gates      | pending | Remaining screens, `format && lint`, `lint:design-system`                                   |

## Session 1 handoff (scout `8c77170f`, mission `4f325349`)

- **Architecture:** Billing/Accounting = Claim workflows. Partnership route prefetches eight oRPC queries → TanStack Query hydration → Suspense/error recovery. Cost Entries contain Allocations; Proof Documents upload separately; reusable Payout Accounts selected per Partnership. Hosting approval/payment separate. Projects feature has **no i18n keys — English literals**.
- **Key code:** `canPartnerEditClaim(status)` + `claimPanelActions(status)` own edit/review authority; `CostEditor`, `ProofEditor`, `ClaimSubmission`, `ClaimDecisionPanel` own mutations. Claims = cards/lists; project discovery = TanStack Table v9, manual server filtering/sorting/pagination.
- **Start here:** `apps/cost-tracker/src/features/projects/components/claim-workspace.tsx` (full Partner accounting surface).
- **Top 5 theme risks:** (1) tokens — primary currently pink (`globals.css`), preserve light/dark contrast; (2) `no-restyle` — layout-only callers, use variants/tokens, native selects/checkboxes coexist; (3) density — nowrap/padded cells + horizontal scroll, keep server pagination; (4) narrow — long IBANs/filenames, allocations, nonwrapping confirmations; (5) states — empties, skeletons, retry/sign-in, field alerts, upload progress, pending/locked controls, checklist anchors.
- **Owned surface:** glossaries, `shadcn.md` + `tanstack-table.md`, `components.json` (base-sera/mist), `globals.css`, claim route + `loading.tsx`, `claim-lifecycle.ts`, `claim-workspace.tsx`, `claim-submission.tsx`, `claim-review.tsx`, `claim-review-queue.tsx`, `project-workspace.tsx`, `project-list.tsx`, error boundary + loading states, `ui/table.tsx`. No source edits made.
- **Full handoff:** `/home/henning/.pi/agent/sessions/--home-henning-_dev-greendex-cost-tracker--/subagent-artifacts/outputs/8c77170f-5022-4c5f-a435-4325ffe19688/context.md`

## Decisions

- (none yet — token/wireframe approval lands here after Session 2)

## Next

- Fire Session 2: brief = this file (no epic issue filed yet) + scout artifact above.
- Session 2 output → `artifacts/erasmus-theme-plan.md`, then human gate on tokens/wires.
