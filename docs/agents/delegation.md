# Delegating and recovering repository work

`AGENTS.md` owns safety and authority; [task routes](agent-workflows.md) owns technical wayfinding. This guide defines contributor policy, independent of the agent runtime. Use the installed tool's documentation for launch and recovery APIs.

## Choose the smallest useful run

- Tiny task: execute directly. Delegate only when separate context, evidence, expertise, or isolation earns the overhead. Direct implementation remains valid when delegation is unavailable.
- The main agent owns scope, decisions, review sequencing, and final acceptance. Children execute bounded contracts, escalate unapproved decisions, and do not launch agents or arrange reviews.
- Keep one writer per worktree, including formatting and lint fixes. The main agent does not edit an active child's worktree. Parallel writers need isolated worktrees with exclusive ownership.
- Before launch, verify actual tool capabilities and permissions; a role name alone does not enforce read-only access. Identify the working directory and branch/ref, preserve existing changes, and explicitly bootstrap dependencies and checks. Never discard changes to satisfy a clean-checkout requirement.

## Compact child contract

Every assignment states:

- **Goal and target:** exact outcome, working directory, branch/ref, and owned files or seam.
- **Permissions:** read/edit/test as needed; commits, issue comments, and other external writes only when explicitly allowed. Pushes, merges, issue closure, production changes, and credential changes require authorization from the human/main agent.
- **Context:** fresh context with relevant ticket/spec, source paths, matching app glossary and scoped instructions, decisions, prior handoffs, and invariants. Pass paths and decision summaries rather than the parent transcript. Share conversation history only for an explicit reason; keep repository safety instructions enabled.
- **Checks:** focused commands and success criteria. Integration suites run serially with enough time for their actual runtime. Final repository-wide gates run once after shared-worktree writers finish.
- **Result:** at most 200 words covering outcome, changed files, checks/pass/fail, blockers, and evidence/artifact paths. Include a commit hash only if a commit was authorized; store large reports and logs in durable artifacts.
- **Escalation:** pause and contact the main agent for unapproved scope, product, architecture, or permission decisions. A skill cannot silently expand the contract: inspect any assigned skill for orchestration, review, and commit requirements first.

## Supervision and acceptance

Use the runtime's supported supervision channel for child questions and active guidance. Inspect run evidence at decision/debugging boundaries rather than polling on a timer. Verify resolved execution settings and permissions instead of assuming a launch request was honored.

A delivered instruction is not proof it was followed; completion is not acceptance. The main agent inspects the affected diff and check evidence, arranges independent review when required, resolves concrete findings, and grants final acceptance. For a fully specified implementation sequence, keep implementation, tests, review, fixes, and any authorized scoped commit in sequential single-writer lanes. A blocked review remains unaccepted until fixes and re-checks pass.

For issue work, follow [ticket progress and close-out rules](issue-tracker.md): external progress comments require authorization, implementation tickets stay open until merged, and dependency blockers remain binding.

## Recovery and durable records

Record the objective, approved decisions, run identifiers, artifact paths, working directory, branch/ref, partial changes, and check state. After compaction or a new session, recover from those records rather than reconstructing chat history. Timeouts and checkpoints are not safe mutation boundaries or guarantees of unattended execution.

After a timeout, failure, or interrupted run:

1. Inspect the exact run state, artifacts, working directory, branch/ref, changed files, and check state. Preserve the partial diff; confirm the old writer is no longer active before any new writer starts.
2. Prefer supported resume with a narrow continuation after verifying eligibility and the stored tool/permission contract. Record the returned run identifier for later recovery.
3. If resume is unavailable or rejected, hand the preserved partial work to a replacement with a precise continuation contract. Label the fallback and explain why; continue existing work rather than reimplementing it.

An infrastructure failure blocks the lane: report it and preserve repository state. Changing tools, providers, or execution modes is not an implicit fallback; ask the owner before changing the approved execution plan. Keep interrupted runs distinct from terminally stopped runs according to the runtime's documented semantics.
