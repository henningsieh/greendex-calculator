# Delegating and recovering repo work

This is the repo's delegation runbook. `AGENTS.md` owns safety and authority; [task routes](agent-workflows.md) owns technical wayfinding. Load the installed `pi-subagents` skill or its `guide` for API details instead of duplicating them here.

## Choose the smallest useful run

- Tiny task: execute directly. Delegate only when separate context, evidence, expertise, or isolation earns the overhead.
- One bounded task: one child. Use `worker` for implementation, `scout` for recon, `researcher` for external sources, `reviewer` for review, or `delegate` for errands.
- A coordinated sequence or parallel wave: one async workflow; children launch inside it. Add a scout or review stage only when it earns its cost. The main agent controls the sequence and accepts the result.
- Parallel writers: isolated worktrees with exclusive ownership. In a shared worktree, one writer at a time, including formatter/linter commands. Prepare or read unaffected material while a child writes; don't edit its worktree.

## Discover and launch

1. If `subagent` is inactive and `subagents_enable` is available, call the loader; use the tools exposed on the next model request.
2. Read `subagent({ action: "list", capabilities: true })` for executable roles and actual tool contracts. Role names alone do not enforce read-only access. Call `subagent({ action: "models" })` before choosing an exact model override.
3. Before an `openai-codex` wave, follow the [quota gate](codex-usage-meter.md). Other providers do not use that meter.
4. Pass an explicit `cwd`, fresh context, and the compact contract below. Async is the default; use native completion notifications rather than status/sleep polling loops.

```js
subagent({
  agent: "worker",
  task: "<goal, target/ref, owned scope, permissions, paths, checks, result, escalation>",
  cwd: "/home/henning/_dev/greendex-cost-tracker",
  context: "fresh",
  async: true,
  // For slow integration work only; ordinary tasks use the runtime default.
  maxRuntimeMs: 3600000,
  checkpointBeforeDeadlineMs: 300000,
})
```

The example's checkpoint is best-effort: finish the active tool call and report partial work before the hard deadline. A timeout is not a safe mutation boundary. Managed worktrees require a clean source checkout and explicit dependency/test bootstrap; never discard existing changes to make a launch pass.

## Compact child contract

Every launch states:

- **Goal and target:** exact outcome, `cwd`, branch/ref, and owned files or seam.
- **Permissions:** read/edit/test as needed; commits, issue comments, or other external writes only when explicitly allowed. Push, merge, close, production changes, and credential changes remain with the human/main agent and require authorization.
- **Paths and constraints:** relevant ticket/spec, app context, scoped docs, prior handoff/artifact paths, and true invariants. Pass paths and decision summaries, not the parent transcript.
- **Checks:** focused commands and success criteria. Integration suites run serially; allow their actual runtime. Final repo-wide gates run once after shared-worktree writers finish.
- **Result:** at most 200 words covering outcome, changed files, checks/pass/fail, blockers, and evidence/artifact paths; include the commit hash only if a commit was authorized. Store large reports/logs in managed artifacts. Bind saved output with the API's `output` field; use `outputMode: "file-only"` for large reports and return the actual output references.
- **Escalation:** use `contact_supervisor` for an unapproved scope, product, architecture, or permission decision. Children do not launch agents or arrange their own reviews.

Choose skills for the assigned task, not by mandatory role prefixes. Inspect a skill's contract before handing it to a leaf child: a skill that arranges reviews, launches agents, or commits cannot silently expand the assignment. The main agent arranges any review and explicitly grants commit permission.

## Context, models, and supervision

[Project settings](../../.pi/settings.json) are authoritative for the default subagent model and each role's thinking level, including reviewers. Keep these defaults unless the task calls for an explicit override; role-specific model overrides take precedence over the shared default. Use `:medium` for pure test execution and `:high` for complex implementation. A per-run thinking override is a model suffix, not the watchdog-only `thinking` field.

Keep `context: "fresh"` explicit: it wins over inherited global preferences. Fork only when the main agent has a specific reason to share conversation history. Keep repo safety instructions enabled in either case. Verify the resolved model/thinking/context in run evidence rather than assuming a typo falls back.

Inspect `status` or `view: "transcript"` at decision/debugging boundaries, not on a timer. Use `steer` for active guidance and `subagent_supervisor` for child questions. A delivered message is not proof the child followed it. Completion is also not acceptance: inspect the affected diff and check evidence; use a runtime gate when verified execution is required.

## Supervised issue-implementation chain

For a fully-specified issue (decisions locked, file lists known): one async workflow, sequential single-writer lanes on the issue branch — implement → test → review → fix-if-blocked → commit. The reusable template lives at [`.pi/workflows/issue-implementation.js`](../../.pi/workflows/issue-implementation.js) (validated script file; launch with `args: { issue, branch, sources, tests, decisions, commitSubject, commitBody }`).

- **Lane model policy** (per-lane overrides on the project default family; the supervisor stays fully engaged): implement `worker` medium, test `worker` low, review `reviewer` high, fix `worker` medium, commit `delegate` low. The mapping lives in the template, not in settings — one role needs different thinking per lane (worker medium vs low), and the reviewer global default stays untouched.
- **Reviewer contract:** ends with exactly `Merge verdict: BLOCK` or `Merge verdict: OK`; the script branches on it (fix + re-check only when blocked, second BLOCK returns uncommitted).
- **Commit scoping:** explicit file lists, never `git add -A`, no pushes. Issue progress comments and final acceptance stay with the parent per [issue tracker](issue-tracker.md).
- **Escalation:** every lane uses `contact_supervisor` instead of guessing; the parent answers via `subagent_supervisor` and steers with `runs.steer`-style guidance. A delivered message is not proof it was followed — verify the diff.

## Recovery and durable records

Keep normal missions for substantive work; use `mission: false` for disposable probes. After compaction or a new chat, recover the objective, decisions, run IDs, and artifact paths from `mission.list` / `mission.show`, not reconstructed chat history. These persisted records are not Pi Durable's checkpointed execution.

After a timeout, failure, or interrupted run:

1. Inspect the exact run ID/status, session/artifact paths, `cwd`/worktree, branch/ref, changed files, and check state. Preserve a partial diff; confirm the old writer is no longer active before any new writer starts.
2. If it is a resumable candidate, attempt `resume` with a narrow continuation. Resume authoritatively checks eligibility and keeps the child's stored model/tool contract; use the newest returned run ID for later continuation. A workflow resume needs a new stable step key.
3. Only if no candidate exists or resume rejects eligibility, launch a replacement with a precise partial-work handoff. Label it as fallback, explain why, and continue existing work rather than reimplementing it.

`interrupt` is a resumable pause where supported; `stop` is terminal and stopped runs cannot resume. A launch/runtime/tooling infrastructure failure blocks the lane: report it and preserve repo state. Retry through the same subagent protocol or ask the owner; switching to a raw CLI/foreground mode is not an implicit fallback. Quota failures wait through the quota gate without silently changing providers.

Pi Durable is a separate experimental harness for checkpointed, restart-safe agent applications, not a switch enabled by these instructions. Consider it only for an explicitly requested unattended service. Neither a quota sleeper nor ordinary subagent missions guarantee execution while the host is off.

For issue work, follow [ticket progress and close-out rules](issue-tracker.md): post an authorized progress comment, keep the ticket open until merged, and respect dependency blockers.
