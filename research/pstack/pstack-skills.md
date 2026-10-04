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

Its harness mapping translates Cursor `Task` to other agents' tools and says to execute roles sequentially if no subagent tool exists. It lists Pi paths, but does not implement this repository's `pi-subagents` role contracts, fresh contexts, async notifications, quota gate or supervisor decisions. It also retains Cursor-specific parameters and external tool assumptions. `make-bot-ui` still uses `update_state` and `SendToUser`; installing a skill does not create those tools. [Harness mapping][mode] [Swarm][swarm] [Bot UI][bot]

Local [`.pi/settings.json`](../../../.pi/settings.json) disables nested subagents for every configured role. [The delegation runbook](../subagent-launch.md) assigns orchestration to the main agent and requires explicit commit/external-write permissions. Fork feature instructions include a fallback for a subagent forbidden to spawn, but other skills still require their own fanouts. Do not hand those unchanged to leaf workers. [Feature][feature]

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
