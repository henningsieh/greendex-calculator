# Erasmus Re-theme: Billing & Accounting (Cost Tracker)

**Status:** Gate 1 visual review (v2) open — revised prototype + 6 fresh screenshots in `docs/design/`, awaiting your rating. Nothing in `src/` touched.
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
| 2   | Theme plan (no code) | done    | Plan at subagent artifact `…/ff1fda3c-…/artifacts/erasmus-theme-plan.md` (161 lines); digest logged below; awaiting human approval |
| 2B  | Static prototype     | done    | `worker [460499b1-…]` complete; `docs/design/prototype/` (2 pages + css); 6 verified screenshots in `docs/design/screenshots/`; critique logged below |
| 2C  | Prototype revision   | done    | `worker [3becd11a-…]` on `gpt-6-astra:medium` complete; theme switch (?theme= + toolbar), charcoal dark, 3 font candidates (?font=); 6 fresh screenshots; notes in v2 review below |
| 3   | Flagship build       | pending | Waits for your Gate 1 rating + explicit go |
| 4   | Emil polish          | pending | Restrained pass, feedback-only motion                                                       |
| 5   | Rollout + gates      | pending | Remaining screens, `format && lint`, `lint:design-system`                                   |

## Session 1 handoff (scout `8c77170f`, mission `4f325349`)

- **Architecture:** Billing/Accounting = Claim workflows. Partnership route prefetches eight oRPC queries → TanStack Query hydration → Suspense/error recovery. Cost Entries contain Allocations; Proof Documents upload separately; reusable Payout Accounts selected per Partnership. Hosting approval/payment separate. Projects feature has **no i18n keys — English literals**.
- **Key code:** `canPartnerEditClaim(status)` + `claimPanelActions(status)` own edit/review authority; `CostEditor`, `ProofEditor`, `ClaimSubmission`, `ClaimDecisionPanel` own mutations. Claims = cards/lists; project discovery = TanStack Table v9, manual server filtering/sorting/pagination.
- **Start here:** `apps/cost-tracker/src/features/projects/components/claim-workspace.tsx` (full Partner accounting surface).
- **Top 5 theme risks:** (1) tokens — primary currently pink (`globals.css`), preserve light/dark contrast; (2) `no-restyle` — layout-only callers, use variants/tokens, native selects/checkboxes coexist; (3) density — nowrap/padded cells + horizontal scroll, keep server pagination; (4) narrow — long IBANs/filenames, allocations, nonwrapping confirmations; (5) states — empties, skeletons, retry/sign-in, field alerts, upload progress, pending/locked controls, checklist anchors.
- **Owned surface:** glossaries, `shadcn.md` + `tanstack-table.md`, `components.json` (base-sera/mist), `globals.css`, claim route + `loading.tsx`, `claim-lifecycle.ts`, `claim-workspace.tsx`, `claim-submission.tsx`, `claim-review.tsx`, `claim-review-queue.tsx`, `project-workspace.tsx`, `project-list.tsx`, error boundary + loading states, `ui/table.tsx`. No source edits made.
- **Full handoff:** `/home/henning/.pi/agent/sessions/--home-henning-_dev-greendex-cost-tracker--/subagent-artifacts/outputs/8c77170f-5022-4c5f-a435-4325ffe19688/context.md`

## Session 2 handoff (delegate `ff1fda3c`, mission `a055381f`)

- **Concept:** Erasmus funding request as working administrative document, not dashboard. Boldness spent once: deep-blue Claim context band with small yellow edge marker (no stars/flag/gradients — no suggestion of official EU endorsement).
- **Six colors:** Trust navy `#102B50`, EU blue `#003399`, EU yellow `#FFCC00`, Paper `#FFFFFF`, Quiet blue `#EDF2F8`, Supporting slate `#52647A`. Yellow is signal-only, never status. Dark mode: navy planes, Quiet-blue buttons (EU blue on navy fails contrast).
- **Type:** Source Sans 3 sole family, tabular EUR figures, right-aligned amounts; sentence case, existing domain terms.
- **Layout:** continuous document plane + quiet action column (no SaaS cards); flagship 2 = presentation-only cost table, no new APIs (supervisor-confirmed).
- **Pink migration:** proposed as separate app-wide approval (primary/ring in both modes) — NOT part of flagship scope.
- **Motion:** feedback-only (`scale(0.97)` 80–120ms, toasts, real progress); reduced-motion disables transforms.
- **Residual risks:** contrast unmeasured (needs rendered screenshots), shared primitive variants vs no-restyle, large-list perf unaddressed, font migration out of scope.
- **Full plan:** `/home/henning/.pi/agent/sessions/--home-henning-_dev-greendex-cost-tracker--/subagent-artifacts/outputs/ff1fda3c-ef5b-4b89-80b5-dbdaf093c695/artifacts/erasmus-theme-plan.md`

## Prototype review v2 (astra revision, my fresh-eyes pass)

- **Toolbar works:** `?theme=light|dark|system` + `?font=geist|mono|slab` honored; light viewable regardless of OS setting. Screenshots captured via explicit `?theme=` URLs.
- **Dark v2:** charcoal page `#09090B`, surface `#18181B`, inset `#27272A`, border `#3F3F46`, text `#E4E4E7`, muted `#A1A1AA`, primary `#2563EB`, links `#93B4FF` — familiar shadcn/zinc universe, blue as action color, navy band + yellow edge kept as identity. Much calmer than full-navy v1.
- **Fonts live to compare:** Geist (Sans + Mono figures), Mono (JetBrains Mono figures), Slab (Roboto Slab headings + Source Sans 3 body). Screenshots show Geist default; try `?font=mono` / `?font=slab` in the browser yourself.
- **Still open (unchanged):** raw `correction_requested` string in Claim-draft line; `Pass: …` checklist copy tone; muted-text WCAG measurement in real build.
- **Files:** `docs/design/prototype/{claim-partner.html,claim-review.html,erasmus.css}`; 6 screenshots refreshed in `docs/design/screenshots/`.

## Prototype review (my fresh-eyes pass)

- **Light desktop:** navy band + yellow edge reads immediately; document plane calm; checklist sidebar legible; cost table comparable with right-aligned amounts. Matches plan.
- **Dark desktop:** navy planes hold together; Quiet-blue buttons stay visible (EU-blue-on-navy avoided as planned). Muted helper text needs measured WCAG AA check in real build.
- **Narrow (390px):** stacks band → decision/submission → evidence in coherent focus order; cost table keeps a labelled horizontal-scroll region, no page-wide overflow.
- **Nits for the real build:** (1) raw `correction_requested` snake_case leaks into the "Claim draft" line — render human status text; (2) sidebar `Pass: …` labels read technical — confirm copy; (3) cross-page "View … prototype" links are prototype chrome, not app UI.
- **Files:** `docs/design/prototype/{claim-partner.html,claim-review.html,erasmus.css}`; `docs/design/screenshots/{claim-partner,claim-review}-{light,dark}-desktop.png` + `*-light-narrow.png` (dark-narrow omitted, same tokens as dark-desktop).

## Decisions

- (none yet — token/wireframe approval lands here after Session 2)

## Next

- You rate the prototype (look + feel + direction).
- On approval (+ any revision list): Session 3 build fires only on your explicit go.
