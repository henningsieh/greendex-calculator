# Research: pstack skills for Greendex

## Summary

Use pstack as a collection of optional techniques, not a replacement operating system for this repository. Start with **`unslop` only**, if its writing style helps; consider a narrowly adapted learning or impact-analysis workflow later. The `backnotprop/pstack` mirror is a reasonable source for cross-agent prompts, but `npx skills add backnotprop/pstack` is not the recommended blanket adoption route: installation support does not establish Pi execution compatibility.

Reviewed on 2026-10-04. External statements below describe inspected source; recommendations are researcher judgment, not measured productivity claims. No installation or workflow execution was performed.

## Findings

### 1. Provenance and current parity

**Claim.** Upstream is Cursor's plugin; the alternative is a separately maintained standalone mirror, not an official Pi integration. **Support: direct evidence. Confidence: high.**

The upstream manifest attributes pstack to **Lauren Tan** and registers `skills/` and `agents/`. The upstream README identifies its author as **Poteto** and self-reports React core-team/React Compiler work. That establishes first-party attribution, not independent verification of employment history or skill effectiveness. Its Grok references are concrete model-routing defaults, not evidence that Grok is required or superior for this monorepo. [Upstream manifest][manifest] [Upstream README][up-readme]

Pinned snapshots:

- Cursor upstream: [`e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a`](https://github.com/cursor/plugins/commit/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a), dated 2026-10-04.
- Mirror main: [`157aae39a733135e93d8b5b19ff62c6a84b0ad56`](https://github.com/backnotprop/pstack/commit/157aae39a733135e93d8b5b19ff62c6a84b0ad56), dated 2026-09-14.
- Mirror's `upstream` branch import: [`838a0da7…`](https://github.com/backnotprop/pstack/commit/838a0da7f07dd96d5a204b610d20df383f2ec43c), explicitly naming Cursor source [`5bf2b154…`](https://github.com/cursor/plugins/commit/5bf2b1544db739998121a306340631963c2ff3de).

The mirror documents an upstream/main merge procedure plus harness-neutral edits. It is **not currently identical** to upstream: the inspected upstream includes `benchmark-checklist` and `principle-explain-the-number`, absent from the mirror tree. Upstream has 24 principle skills; the mirror README inventories 23. This is observed divergence, not merely an inference from commit dates. [Mirror maintenance][mirror-maint] [Upstream tree][up-tree] [Mirror tree][fork-tree]

### 2. What is actually available

**Claim.** pstack mixes short editing prompts with substantial execution workflows. **Support: direct evidence from SKILL.md files and supporting files. Confidence: high.**

Inventory below uses directory names; declared frontmatter names are not always identical. Links point to the inspected mirror snapshot, except the upstream-only additions.

| Skills                                                                                         | Purpose and operational character                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`unslop`][unslop], [`bro`][bro]                                                               | Remove writing patterns; restate the last answer plainly. Small, single-agent editing prompts.                                                                                 |
| [`technical-writing`][writing]                                                                 | Documentation structure and sentence rules; applies `unslop`. Style guidance, not an autonomous shipping system by itself.                                                     |
| [`typescript-best-practices`][ts], [`tdd`][tdd]                                                | Type/boundary guidance with principle dependencies; narrowly scoped failing-before/passing-after bug-fix testing.                                                              |
| [`how`][how], [`why`][why], [`teach`][teach]                                                   | Explain runtime flow; investigate rationale through history and available evidence systems; combine those into teaching. These are not all cheap single prompts.               |
| [`blast-radius`][blast]                                                                        | Identify non-obvious downstream breakage and execute proof of the central safety assumption; optionally use an arena for wide changes.                                         |
| [`architect`][architect], [`arena`][arena]                                                     | Trace existing systems, compare competing design sketches, implement; or generate competing artifacts, cross-judge, select and combine them.                                   |
| [`swarm`][swarm], [`interrogate`][interrogate]                                                 | Parallel coverage/races; independent multi-model adversarial review with synthesized judgment. `interrogate` explicitly does not auto-apply findings.                          |
| [`no-comments`][comments]                                                                      | Comment-review agent, accepted fixes, possible design work and constraint encoding. More than a text cleanup prompt.                                                           |
| [`recall`][recall], [`reflect`][reflect], [`automate-me`][automate]                            | Rebuild context from sessions/shared records; review a session for skill edits; mine working conventions into a personal mode. Transcript access and additional passes matter. |
| [`show-me-your-work`][trail], [`figure-it-out`][figure]                                        | TSV decision trail with transcript audit and cross-model review; design and execute an auditable bespoke workflow.                                                             |
| [`create-verification-skill`][create-verify], [`maintain-verification-skill`][maintain-verify] | Generate project-local launch/drive/evidence instructions and feature maps; audit source and exercise every mapped feature live.                                               |
| [`setup-pstack`][setup], [`poteto-mode`][mode], [`make-bot-ui`][bot]                           | Configure role models; route through 23 playbooks; build a Cursor/Grok webhook UI with secret-request and Tailscale instructions. The last is not a generic frontend skill.    |
| Upstream-only [`benchmark-checklist`][benchmark]                                               | Check benchmark errors, actual work, tuning, repeatability, bottlenecks and user-visible relevance. Companion to `principle-explain-the-number`.                               |

The mirror's **23 `principle-*` skills** are small rules, grouped in its [README][fork-readme]:

- Core: `laziness-protocol`, `foundational-thinking`, `redesign-from-first-principles`, `attack-the-premise`, `subtract-before-you-add`, `minimize-reader-load`, `outcome-oriented-execution`, `experience-first`, `exhaust-the-design-space`, `build-the-lever`.
- Architecture: `model-the-domain`, `boundary-discipline`, `type-system-discipline`, `make-operations-idempotent`, `migrate-callers-then-delete-legacy-apis`, `separate-before-serializing-shared-state`.
- Verification: `prove-it-works`, `fix-root-causes`, `sequence-verifiable-units`, `test-behavior-not-implementation`.
- Delegation/meta: `guard-the-context-window`, `never-block-on-the-human`, `encode-lessons-in-structure`.

These cover deletion, data modeling, boundaries, verification, parallel ownership and durable enforcement. They are advice, not enforcement mechanisms; the router activates their larger workflows. [Mode][mode]

### 3. Where execution and token costs come from

**Claim.** The costly part is repeated work and delegation, not simply having Markdown on disk. **Support: direct workflow evidence; cost implications are researcher inference. Confidence: high on workflow counts, medium on resulting cost.**

Notable prescribed passes:

- **`how`:** even the simple path spawns **one explainer**. Complex questions spawn **2–4 explorers plus one explainer**. It defaults to the simple path when uncertain. [Skill and reference templates][how]
- **`why`:** source-control investigator always, up to seven evidence categories according to available tools, then a synthesizer. Its default posture is a full investigation, with explicit justification for omitted categories. [why][why]
- **`arena`:** four default candidates, one cross-judge, parent reading/scoring, combination and verification. **`architect`** additionally runs `how`, conditionally `why`, and arena; redesign can repeat the process. [arena][arena] [architect][architect]
- **`interrogate`:** four default reviewer models and lead synthesis. **`reflect`:** three reviewers and a separate synthesizer before approved skill edits; backlog filing is automatic in its instructions. [interrogate][interrogate] [reflect][reflect]
- **`show-me-your-work`:** log writing is small, but end-of-run transcript audit and a different-family reviewer are mandatory. **Maintenance verification:** one source reader per feature, then live coverage of every feature. [trail][trail] [maintenance][maintain-verify]
- **`poteto-mode`:** feature work routes through explanation/design, mandatory implementation ownership separation, verification, ordered commits and PR opening. Hillclimb repeats change/measurement/regression gates and commits accepted improvements; shipping verifies each PR independently and performs push/merge operations. [Feature][feature] [Hillclimb][hillclimb] [Shipping][shipping]

**Inference:** larger diffs, multiple copies of grounding, high-reasoning model defaults, competing implementations, rework, full transcripts and live application checks can dominate usage. Parallelism can reduce elapsed time while increasing total model work. `setup-pstack` changes reasoning budgets and panel lengths, but does not remove the workflow's stages. No verified dollar estimate or Greendex productivity benchmark is available. [Setup][setup]

There is also real setup beyond Markdown: router scripts include Bun tooling; `bootstrap.ts` runs `bun install --frozen-lockfile` when dependencies need installation. The decision-log helper is a Bash append script. Neither needs to accompany a standalone `unslop` trial. [Bootstrap][bootstrap] [Log helper][log]

### 4. Portability is conditional, especially in this Pi setup

**Claim.** The mirror improves portability but does not supply a tested Pi orchestration adapter. **Support: direct source plus local configuration comparison. Confidence: high on mismatches; actual runtime behavior untested.**

Its harness mapping translates Cursor `Task` to other agents' tools and says to execute roles sequentially if no subagent tool exists. It lists Pi paths, but does not implement the personal `pi-subagents` setup inspected at review time: role contracts, fresh contexts, async notifications, quota gate or supervisor decisions. It also retains Cursor-specific parameters and external tool assumptions. `make-bot-ui` still uses `update_state` and `SendToUser`; installing a skill does not create those tools. [Harness mapping][mode] [Swarm][swarm] [Bot UI][bot]

[The repository delegation policy](../../docs/agents/delegation.md) assigns orchestration to the main agent, forbids nested delegation by children, and requires explicit commit/external-write permissions. Fork feature instructions include a fallback for a subagent forbidden to spawn, but other skills still require their own fanouts. Do not hand those unchanged to leaf workers. [Feature][feature]

More serious policy conflicts:

- Router autonomy permits reversible external actions without asking; the repo requires explicit permission. [Mode][mode] [AGENTS.md](../../../AGENTS.md)
- Opening-a-PR includes `git reset --hard` as a fallback and liberal committing; repo rules forbid destructive commands and unauthorized commits. [PR playbook][pr]
- Verification generation prescribes starting an app and fixing a broken base; this repo says never start another dev server. Existing Playwright coverage must be reused, not bypassed. [Generator][create-verify] [AGENTS.md](../../../AGENTS.md)

Many inspected skills already have `disable-model-invocation: true`, including `unslop`, `how`, `teach`, TypeScript, `architect`, review and trail skills. In installed Pi documentation, that makes them explicit-only; use `/skill:unslop`, not an assumed Cursor slash command. Pi loads detailed instructions on demand, warns on collisions and keeps the first discovered name. Existing **`tdd` and `teach` names collide** with this user's supplied/discovered skills. Extra `mode`, `icon`, `color` and `reminder` fields in `Poteto Mode` do not establish Pi sticky-mode support. [Skill frontmatter][mode] [Installed Pi docs, locally verified](file:///home/henning/.local/share/pnpm/global/v11/267292-18db3b0e7be50825-0/node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.2_@aws-sdk+credential-provider-node@3.972.84_@smithy+signature-v4@5.7.4_ws@8.22.0/node_modules/@earendil-works/pi-coding-agent/docs/skills.md)

### 5. What earns a place here

**Researcher judgment**, based on the documented setup rather than an assumption about the user's programming experience:

| Choice                             | Recommendation                             | Why                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unslop`                           | Optional first trial, personal/global      | Distinct writing aid, no subagents or runtime setup. Its absolute punctuation/style rules are preferences, not correctness rules.                                                                                                  |
| `bro`, `technical-writing`         | Use only for recurring writing needs       | `bro` is easily requested in ordinary language. Writing depends on `unslop`; local documentation ownership and five document kinds remain authoritative.                                                                           |
| `how` / `blast-radius`             | Borrow techniques; budget-bound adaptation | Useful traced explanations and executable safety facts. Start inline or one parent-managed read-only child; do not automatically activate broad research/design loops.                                                             |
| TypeScript/principles              | Optional curated repo supplement           | Existing [code standards](../instructions/code-standards.md) already cover unknown/narrowing, inferred schemas, boundary authorization and behavioral tests. Add only a demonstrated missing rule, not another competing standard. |
| `tdd`, `teach`, `architect`        | Keep existing coverage first               | Name collisions for the first two; supplied `codebase-design` already covers deep modules/design alternatives. Existing `tdd`, domain-modeling and prototype skills reduce marginal value.                                         |
| `interrogate`, `arena`, `swarm`    | Exceptional parent-controlled use          | Existing code review, council-mode and pi-subagents cover much of this. Choose a second independent review for high-risk work, not a four-model panel for every diff.                                                              |
| Router/setup/overnight workflows   | Do not adopt now                           | Competing orchestration, tool assumptions, external actions, commit policy and runtime setup outweigh an unmeasured benefit.                                                                                                       |
| Verification generator/maintenance | Defer until a specific coverage gap exists | Existing Vitest/Playwright and scoped instructions are the starting point. No evidence here that another generated feature map is needed.                                                                                          |

The supplied skill inventory also covers research, diagnosing bugs, grilling, CodeRabbit review/autofix and frontend design; repo skills include Better Auth, shadcn and Turborepo. These are baseline coverage, not claims that every existing skill is better. Preserve the repo's contexts, ADRs, scoped routes and installed-version Next.js docs as sources of truth. [Task routes](../agent-workflows.md) [Documentation index](../../README.md)

### 6. Scope and selective installation

**Claim.** Current official CLI Pi targeting uses shared Agent Skills directories, not Pi-private directories. **Support: direct implementation inspection. Confidence: high for pinned CLI source; installed CLI behavior not tested.**

Pi accepts project `.pi/skills/` and `.agents/skills/`, and user `~/.pi/agent/skills/` and `~/.agents/skills/`. However, inspected official CLI `agents.ts` maps Pi to **`.agents/skills/` and `~/.agents/skills/`**, and installer universal-agent handling avoids redundant symlinks. `--agent pi` does not make these shared directories private from other agents. [CLI agent map][cli-agents] [Installer][installer] [Installed Pi docs](file:///home/henning/.local/share/pnpm/global/v11/267292-18db3b0e7be50825-0/node_modules/.pnpm/@earendil-works+pi-coding-agent@1.0.2_@aws-sdk+credential-provider-node@3.972.84_@smithy+signature-v4@5.7.4_ws@8.22.0/node_modules/@earendil-works/pi-coding-agent/docs/skills.md)

**Recommended placement:** generic personal writing in `~/.pi/agent/skills/` if Pi-only discovery is desired; shared cross-agent writing in `~/.agents/skills/`; repo-specific commands or safety constraints in reviewed project skills. Do not copy Greendex rules into global skills. Prefer a distinctly named curated skill over silently replacing `tdd` or `teach`.

Examples below are **not executed**, track mutable repository main, and require source reinspection before adoption:

```bash
# Discover without installing skills.
npx skills add backnotprop/pstack --list

# Generate one temporary-use prompt, without installing the skill.
npx skills use backnotprop/pstack --skill unslop

# Optional personal cross-agent trial: writes ~/.agents/skills, NOT ~/.pi/agent/skills.
npx skills add backnotprop/pstack --skill unslop --agent pi --global

# Alternative project scope: writes .agents/skills in this repo.
npx skills add backnotprop/pstack --skill unslop --agent pi
```

`--list` exits before installation. `skills use` creates temporary files; it is not a zero-write or offline operation, and its direct `--agent` launch support does **not** include Pi at this snapshot. Reading the pinned `SKILL.md` in a browser is the lowest-setup preview. [CLI README][cli-readme] [Use implementation][use]

Avoid bare `add`, `--all`, or `--skill '*'`. The README describes interactive selection, but current `add.ts` detects AI-agent execution and enables noninteractive mode; without explicit skill selection that can select every discovered skill. Selectivity is therefore a safety measure, not just convenience. Selection does not provide automatic resolution of prose-level skill dependencies. [Add implementation][add]

The mirror's dependency table is incomplete: TypeScript references two principles; `teach` also applies `unslop`; `architect` conditionally calls `why`; `figure-it-out` reads the router and calls trail/design skills. Inspect bodies and supporting files rather than treating “works alone” as “no dependency/no delegation.” [Mirror README][fork-readme] [TypeScript][ts] [Teach][teach] [Architect][architect] [Figure it out][figure]

## 7. Author guide (Pt. 1-2) and independent deep dive — supplement added 2026-10-04

Direct fetches of the two X article URLs ([Pt. 1][guide-pt1-x], [Pt. 2][guide-pt2-x]) returned HTTP 403, so the Pt. 1-2 content below was read from ThreadNavigator mirrors of those X articles plus a written Pt. 2 summary; the Copes post was read in full. These are narrative/usage sources, not SKILL.md behavior evidence, and volume claims (2,000 PRs/month) are author-reported, not independently verified. They do not change the adoption recommendation in section 5; they explain _why_ the author sequences verification first and planning-through-code second.

### 7.1 Pt. 1: verification is all you need

- Framing: raw PR/LOC counts were previously treated as vanity metrics; volume only matters once quality is held constant. The Grok @Bot story is used as proof: a small fresh codebase scaled to hundreds of PRs/day while the author acted as gardener/maintainer (refactors, lints, checks, features) without downtime. [Pt. 1 mirror][guide-pt1-mirror]
- Core thesis: a high-quality verification skill is critical infrastructure, not "just" a skill; it lets agents close the loop without the human as bottleneck and is claimed to 100-1000x team output. Prequel on first verification skill: _Loops You Can Trust_. [Pt. 1 mirror][guide-pt1-mirror] [Loops][loops-trust]
- Build path: install pstack, run `/create-verification-skill`; optionally use Dr Eggbot (a Grok Bot that ships pstack) to scaffold an engineer bot and schedule `/maintain-verification-skill` daily. The bot/cloud-agent specifics are Cursor/Grok-Bot context, not Pi instructions. [Pt. 1 mirror][guide-pt1-mirror]
- Stack advice: prefer a rich debuggable runtime (CDP for web/Electron, iOS simulator); otherwise build tools or a dev sidecar (e.g. lldb, custom package). The author explicitly says she would choose tech stack or build debugging tools to gain agent-verification leverage. [Pt. 1 mirror][guide-pt1-mirror]
- "Build the Lever": give agents a small scripted CLI, not just markdown. Rationale: fewer tokens per action, reproducible, testable. Example shape: `doctor`, `new-session`, `send`, `press`, `snapshot`, `screenshot`, `wait-settle`, `feature-flag`, plus inspection/navigation/interaction/performance/streaming/health command families. [Pt. 1 mirror][guide-pt1-mirror]
- Agent-friendly CLI properties valued: composable (deep-module style), `--dry-run` for destructive commands, subcommands for gradual disclosure, descriptive errors that say what to do instead, rich `--help`, machine-readable (JSON) output. Also: seedable dev DB, test users/auth, consistent env bring-up. [Pt. 1 mirror][guide-pt1-mirror]
- Parallelism: recommends against local worktrees at scale (storage/compute; ~10 agents depending on repo/machine) and prefers Cursor cloud agents (real machine, deps, app, video/screenshots) with snapshots for fast startup. Do **not** copy this verbatim here: this repo forbids extra dev servers and Coolify manages deploys; the transferable idea is isolation plus fast environment setup, not Cursor cloud. [Pt. 1 mirror][guide-pt1-mirror]
- Feature Maps: a searchable map of every feature, user-POV access path, agent driving commands, and gotchas. Presented as "materialized memory": compact, token-saving, shared markdown derived from the codebase as source of truth. Example Atlas map and `/create-verification-skill` output scaffold `references/features/` with a README index. Maintain at least daily; agents may also update maps as they work, with `/maintain-verification-skill` catching the rest. [Pt. 1 mirror][guide-pt1-mirror] [Feature-map example][feature-map-example] [Example skill][verify-example]
- Usage prompts worth borrowing (adapted, not quoted as Pi commands): build a feature with `/control-app` verification plus video/screenshots; perf work as trace-baseline then targeted fix confirmed with `/swarm` for sample size/fuzzing; pipe user reports (e.g. Slack) into reproduce-then-optionally-fix routines. Verification skill becomes the foundation other routines compose on. [Pt. 1 mirror][guide-pt1-mirror]
- Maintenance stance: treat the skill like production infra, keep sharpening the CLI, consider oncall rotation. [Pt. 1 mirror][guide-pt1-mirror]

### 7.2 Pt. 2: supervising someone smarter than you

- Two observed failure modes even with frontier models: intent underspecified/poorly specified, and missing context for doing the work correctly. The fix is priming the context window with high-quality context. [Pt. 2 mirror][guide-pt2-mirror]
- Indirect-prompt technique: ask the agent to restate the problem in its own plain words before acting (e.g. read the report thread, restate the underlying issue). Stated benefits: compresses noise into a problem statement, surfaces misunderstanding early, avoids anchoring the agent on the human's possibly wrong hypothesis. [Pt. 2 mirror][guide-pt2-mirror]
- `/teach` (explain intuitively; calls `/how` + `/why`), `/how` (runtime mechanics; complex subsystems split into 2-4 parallel explorers, e.g. on Grok-class fast models), `/why` (motivation from parallel evidence: git/PRs, tickets, docs, chat, monitors, errors, lineage, analytics), `/recall` (rebuild context from past transcripts + git/PR state). Claim: the teaching/research pass helps the agent too, by forcing evidence over confident assertion. [Pt. 2 mirror][guide-pt2-mirror] [Pt. 2 summary][guide-pt2-summary]
- "I don't believe in planning" is cheeky framing: she plans _through code_ (readme-driven development). For shared packages/frameworks (example: in-house desktop client framework Dune), write the tutorial first to feel the developer experience, then work backwards to implementation. [Pt. 2 mirror][guide-pt2-mirror]
- `/technical-writing` exists because the first readme draft mixed goals and AI slop: it enforces Diataxis separation (tutorial, how-to, reference, explanation) plus `/unslop` readability. A written plan doubles as the agent's checkable target. Note for Greendex: this Diataxis scheme is _not_ the repo's five documentation kinds (decision/instruction/model/open-work/archive); use it for published-docs readability, not as a replacement taxonomy. [Pt. 2 mirror][guide-pt2-mirror]
- Compounding example (virtualization engine): (1) `/recall` past bug/perf work, `/how`+`/why` current implementation; (2) `/poteto-mode` planning + `/technical-writing` starting from a usage tutorial for categorical flicker/jitter elimination; (3) `/teach` proof of superiority with verification evidence. [Pt. 2 mirror][guide-pt2-mirror]
- "Measure a hundred times, cut once": two mistakes are accepting the first design and overcooking abstract plans without empirical evidence. Playbooks are conditionally loaded reference files inside `/poteto-mode` (23 as of 0.15.0), not separately invoked skills. Prototyping is planning-with-code: throwaway sketches behind a switcher, driven by `/control-app`, judged by screenshots/videos/timings. [Pt. 2 mirror][guide-pt2-mirror]
- `/architect` five phases: ground (`/how`, conditional `/why`), sketch (parallel cross-model candidate runners producing caller usage + types/signatures + rationale, screened for interface depth and design red flags), cross-judge/synthesize (different model than the author), implement against sketch (surface deviations), scrap on pattern-level friction (repeated same-shape workarounds, `any`/casts, unanticipated params/state). Explicitly: do not adversarially review abstract plans; agents hallucinate theoretical risks for problems that never occur. [Pt. 2 mirror][guide-pt2-mirror]
- No dedicated planning skill; the multi-phase-plan playbook turns an accepted design into a tactical execution plan where every task is proof-structured (tests alone insufficient; must run and verify), machine-validated for structure, executed as small self-contained PRs. Large plans may be temporarily committed for agent visibility, then deleted. [Pt. 2 mirror][guide-pt2-mirror]
- Concrete `/poteto-mode` prompt shapes: ambiguous bug (state what is known, data used, hypotheses); new service boundary (`/architect` first, prototypes for open questions, human review gate); multi-PR migration (small verifiable PRs with visual regression + live steps, exact parity "bugs included"); Slack reports (`do it` when context suffices, else repro-on-main then fix with video proof). Closing line: abstract plans give the illusion of progress; investigation plus empirical evidence plus verification makes agent engineering repeatable. [Pt. 2 mirror][guide-pt2-mirror]

### 7.3 Copes deep dive: the practical operator's framing

- Inventory at time of writing: 24 workflow skills, 23 engineering principles, 22 user-facing playbooks plus internal Opening-a-PR, 2 subagents (`poteto-agent`, Comment Sicko), helpers, dormant Benny automation pack. Counts drift with versions; treat as orientation, not a pinned manifest. [Copes][copes]
- Router mental model: request -> `poteto-mode` -> principles index -> playbook match (copied verbatim into the todo list, skipped steps recorded with reasons) -> specialist skills -> model-role delegation -> inspection/verification -> clean/review/ship. Sticky mode across turns; `new task` resets routing; append read-only constraints ("do not change code yet") when investigating. [Copes][copes]
- Playbook groups: understand-before-changing (Investigation via `/how`, plus `/why` for history/intent); build/change (bug repro-first, feature via `/how`+`/architect`+delegated implementation+real-interface verification, refactoring via pre-recorded behavior + small green steps, perf via trace baseline comparison, hillclimb hypothesis loops, throwaway prototypes, screenshot-gated visual parity); diagnose-only forensics; long-work scaling (autonomous single task vs autopilot queue/stack vs multi-day orchestrate coordinator — "a long task is not automatically a program"); pickup/pause-safely against redoing hours of work; babysit-then-ship split (green means ready for a merge decision, not auto-merge). [Copes][copes]
- Skill notes: `/how` narrows to one explainer or fans to 2-4 explorers + synthesizer (concepts/flow/files/gotchas, not annotated source); `/why` keeps facts separate from inference and reports empty searches; `/teach` for "convince me this fixes the cause"; `/recall` for "catch me up on last week's export work". `/architect` starts from caller usage; `/arena` runs one brief N ways then cross-judges, picks a base, folds in best ideas (agreement = evidence, wild divergence = underspecified brief); `/swarm` splits coverage/races into one report (coverage vs comparison); `/interrogate` diversifies by model (not persona), never auto-applies, and publishes a dismissed-with-reasons section. [Copes][copes]
- Principles as steering names, not commands ("apply prove-it-works, run the real import flow"); the reply must name the decision changed. Verification matched to the change surface (CLI runs the command, UI walks the flow, migration replays input, perf compares traces, storage reads back). `/create-verification-skill` makes "verify it" a repo capability (launch, health-check, drive, evidence, cleanup of only what it started) with a feature map; `/maintain-verification-skill` re-checks map vs source plus one live pass. [Copes][copes]
- Overnight shape: checkable finish condition ("zero old callers, fixtures pass, old API deleted") beats durations; `/loop` wakes on event/heartbeat; per-iteration change -> verify -> keep-or-discard -> commit wins -> one TSV decision row (time/phase/decision/reason/evidence/result), local by default, committed only for audit-grade work. [Copes][copes]
- Explicitly _not_ in pstack: `/deslop`, `control-cli`/`control-ui` (separate `cursor-team-kit`), `/create-skill`, `/babysit`, `/loop` (Cursor builtins; pstack's babysit playbook supersedes built-in babysitting for PR status), GitHub/Graphite assumptions in shipping playbooks, and Benny (Slack triage -> computer-use repro incl. traces/snapshots -> fresh-worker verification + video + PR; work in progress toward "trust one complete loop before multiplying it"). Personalization via `/automate-me` (mine transcripts into `<name>-mode`) and `/reflect` (multi-reviewer proposals, explicit approval gate so one odd task never becomes permanent law). [Copes][copes]
- Cost/use guidance quoted because it matches section 3: don't run the full machine on date changes or config tweaks; routine work on efficient models (Composer-class), frontier models for hard parts; prefer the shorter human-close loop (author's contrast is `fstack`) for small work and pstack for deep investigation, adversarial review, runtime proof, and auditable autonomy. First-workflow prompt shape: `/poteto-mode <observation/request>. Done means <runnable/inspectable check>. Keep <behavior that must not change>.` Then direct `/how`, `/why`, `/interrogate`, `/bro` as needed. Mistakes to avoid: prescribing skill sequences instead of goal+constraints, vague finish conditions, shared working dirs for parallel writers, `/swarm`-vs-`/arena` confusion, and accepting green builds as behavior proof. [Copes][copes]

### 7.4 What this changes for the Greendex strategy (judgment)

- The verification-skill idea transfers, but the implementation does not: reuse existing Vitest/Playwright seams, calculator SSR regression coverage, and seeded fixtures; do not add a new always-on CLI, dev server, cloud-agent setup, or worktree scheme. The closest low-cost adoption is a stricter prompt contract on real behavior (run the flow, read the record back, attach the evidence).
- `/recall` is attractive for multi-session migrations, but transcript paths in these sources are Cursor/Codex-shaped; Pi sessions live under `~/.pi/agent/sessions/` and other projects' chats are off-limits. Any recall-like habit here must be scoped to the active workspace and committed artifacts (decision log, plan, branch state), not cross-project transcript mining.
- The Pt. 2 compound (recall -> how/why -> tutorial-first plan -> teach-as-proof -> prototype/architect) is the highest-value _and_ highest-cost pattern in the set. Reserve full form for migrations, new service boundaries, and hard perf work; for routine fixes keep the existing diagnose -> smallest coherent change -> regression-at-lowest-seam loop.
- `/technical-writing` + `/unslop` fit the Documentation app best, but Diataxis must not leak into the repo's five documentation kinds. Keep decision records immutable (new ADR on reversal), instructions mutable, and archives frozen; use the writing skills for clarity, not taxonomy.
- Prompt shape to steal immediately: goal first, then a machine-checkable "done means", then invariants to preserve. That single habit captures most of the Pt. 2 value without installing orchestration.

## Contradictions

- “Works in any harness” is broader than demonstrated execution compatibility; residual Cursor tools and unimplemented Pi mappings remain.
- “Kept in sync” does not mean current parity; the pinned trees differ.
- “Standalone” README entries can still call principles, other skills or subagents.
- Interactive install expectations differ from the CLI's AI-context noninteractive path.

Sources and concrete examples are recorded above rather than silently resolving these tensions.

## Missing evidence

No Pi smoke test, complete security audit, task-specific token measurements or quality comparison was performed. `source_check` retrieved passages but supplied no automated semantic verdict; recommendation-critical wording was checked manually against original pinned files. Generic cross-agent frontmatter and installation are not proof of workflow portability.

## Sources

- **Kept:** upstream manifest/guide/tree for provenance and inventory; mirror SKILL.md/reference/script files for actual behavior; official CLI source for installer semantics; installed Pi documentation and narrow local instructions for fit.
- **Deprioritized:** search summaries, third-party skill directories and marketing effectiveness claims. They add little to directly inspectable workflow evidence.

## Next steps

Trial `unslop` on a few real documentation tasks, or install nothing and request its editing behavior explicitly. Keep it only if it improves clarity without distorting technical meaning. Consider one bounded, distinctly named repo-specific adaptation only after a repeated gap appears; retain the existing parent-owned delegation and final checks.

[manifest]: https://github.com/cursor/plugins/blob/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack/.cursor-plugin/plugin.json
[up-readme]: https://github.com/cursor/plugins/blob/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack/README.md
[up-tree]: https://github.com/cursor/plugins/tree/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack/skills
[fork-tree]: https://github.com/backnotprop/pstack/tree/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills
[fork-readme]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/README.md
[mirror-maint]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/MIRROR.md
[unslop]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/unslop/SKILL.md
[bro]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/bro/SKILL.md
[writing]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/technical-writing/SKILL.md
[ts]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/typescript-best-practices/SKILL.md
[tdd]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/tdd/SKILL.md
[how]: https://github.com/backnotprop/pstack/tree/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/how
[why]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/why/SKILL.md
[teach]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/teach/SKILL.md
[blast]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/blast-radius/SKILL.md
[architect]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/architect/SKILL.md
[arena]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/arena/SKILL.md
[swarm]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/swarm/SKILL.md
[interrogate]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/interrogate/SKILL.md
[comments]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/no-comments/SKILL.md
[recall]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/recall/SKILL.md
[reflect]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/reflect/SKILL.md
[automate]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/automate-me/SKILL.md
[trail]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/show-me-your-work/SKILL.md
[figure]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/figure-it-out/SKILL.md
[create-verify]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/create-verification-skill/SKILL.md
[maintain-verify]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/maintain-verification-skill/SKILL.md
[setup]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/setup-pstack/SKILL.md
[mode]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/SKILL.md
[bot]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/make-bot-ui/SKILL.md
[benchmark]: https://github.com/cursor/plugins/blob/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack/skills/benchmark-checklist/SKILL.md
[feature]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/playbooks/feature.md
[hillclimb]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/playbooks/hillclimb.md
[shipping]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/playbooks/shipping.md
[pr]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/playbooks/opening-a-pr.md
[bootstrap]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/poteto-mode/scripts/bootstrap.ts
[log]: https://github.com/backnotprop/pstack/blob/157aae39a733135e93d8b5b19ff62c6a84b0ad56/skills/show-me-your-work/scripts/log.sh
[cli-readme]: https://github.com/vercel-labs/skills/blob/18f96ea131dab3b0fcc9b27cf7c6f6cbb6174680/README.md
[cli-agents]: https://github.com/vercel-labs/skills/blob/18f96ea131dab3b0fcc9b27cf7c6f6cbb6174680/src/agents.ts
[installer]: https://github.com/vercel-labs/skills/blob/18f96ea131dab3b0fcc9b27cf7c6f6cbb6174680/src/installer.ts
[add]: https://github.com/vercel-labs/skills/blob/18f96ea131dab3b0fcc9b27cf7c6f6cbb6174680/src/add.ts
[use]: https://github.com/vercel-labs/skills/blob/18f96ea131dab3b0fcc9b27cf7c6f6cbb6174680/src/use.ts
[guide-pt1-mirror]: https://threadnavigator.com/thread/2094457600259842065/
[guide-pt2-mirror]: https://threadnavigator.com/thread/2097732320606507506/
[guide-pt2-summary]: https://hraness.com/reading/the-complete-guide-to-pstack-pt-2
[copes]: https://flaviocopes.com/pstack/
[loops-trust]: https://x.com/poteto/status/2069824386283319343
[verify-example]: https://github.com/poteto/verification-skill-example
[feature-map-example]: https://github.com/poteto/verification-skill-example/blob/main/.cursor/skills/verify-atlas/references/features/README.md
[guide-pt1-x]: https://x.com/poteto/article/2094457600259842065
[guide-pt2-x]: https://x.com/poteto/article/2097732320606507506
