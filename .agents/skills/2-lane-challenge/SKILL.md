---
name: 2-lane-challenge
description: Run two independent implementation lanes for a GitHub issue, review both results, and merge the winner.
disable-model-invocation: true
---

# 2-Model Challenge: implement GitHub issue #<N>

Run two implementation lanes in parallel, review both with their own model,
merge the winner, close the ticket.

## 0. Read the ticket

```bash
gh issue view <N> --json title,body --jq .body
```

Take from `## Implementation guidance` the **Recommended thinking level**
(`medium`, `high`, or `xhigh`). Call it `<T>`. Use it as the model suffix
for every child below (e.g. `:medium`). It is a starting recommendation, not
scope permission: if the ticket's assumptions break, stop and escalate.

## 1. Fire 2 worker lanes (one async workflow, `worktree: true`)

- Agent: `worker`, `context: "fresh"`, `cwd` = repo root.
- Lane A model (exact registry id): `opencode-go/space-bunny-free:<T>`
- Lane B model (exact registry id): `opencode-go/muse-spark-1.3-contributor:<T>`
- Each task MUST start with exactly: `/skill:implement`
- Each lane gets an isolated managed worktree and commits to its dedicated
  branch: `challenge/<N>-space-bunny-free` / `challenge/<N>-muse-spark-1.3`
  (commit authorized; no push, merge, close, or issue comments).
- Brief must contain: goal + acceptance criteria from the ticket, owned scope
  (files/seams), constraints (app `CONTEXT.md`, scoped
  `docs/agents/instructions/*.md`, glossary), checks (focused vitest +
  `pnpm run format` + `pnpm run lint`, report unrelated failures), result ≤200
  words + commit hash, escalation via `contact_supervisor`. Children launch no
  agents and arrange no reviews.
- Base: clean HEAD of the integration branch named in the ticket.

## 2. Review: one reviewer per lane, same model as its lane

Only after a lane commits. Each review task MUST start with exactly:
`/skill:code-review`

- Lane A reviewer model: `opencode-go/space-bunny-free:xhigh`
- Lane B reviewer model: `opencode-go/muse-spark-1.3-contributor:xhigh`
  (`:xhigh` keeps the reviewer default; implementation used `:<T>`.)
- Agent: `reviewer`, read-only (no edits/commits). Give each a detached
  checkout of its lane commit (branchless, e.g. `/tmp/compare-<N>-<lane>`).
- Brief: two axes done by the child itself (never sub-delegated) —
  **Standards** (repo instruction files + glossary, smells as judgement
  calls, ≤400 words) and **Spec** (ticket acceptance criteria quoted per
  finding, missing/partial/creep/wrong, ≤400 words) — plus one summary line
  per axis. Fixed point = integration-branch HEAD the lane started from.
- NOTE: a leaf child cannot run the `code-review` skill's own fan-out (no
  nested agents), so inline both axis briefs in the task instead.

## 3. Compare, merge, close

- Side-by-side on the ticket's acceptance criteria, not on finding counts
  (different reviewers ≠ comparable scores).
- Merge the winner into the integration branch, post a progress comment on
  the issue (commit hash, review result, unrelated failures), keep the
  ticket open until merged, then close it. Delete the losing branch only on
  explicit owner approval.

## Prefix cheat-sheet

| Child                 | Prefix the task with | Why                                                                 |
| --------------------- | -------------------- | ------------------------------------------------------------------- |
| implementation worker | `/skill:implement`   | implement skill contract: TDD at seams, typecheck, commit to branch |
| reviewer              | `/skill:code-review` | two-axis review contract (axes inlined, see step 2 note)            |

Mixing them up sends the wrong contract: workers would self-review,
reviewers would try to implement or spawn agents.
