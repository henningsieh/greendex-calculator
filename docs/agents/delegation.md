# Delegate and recover repository work

Direct work and authorized delegation are both valid. Use the chosen harness and user configuration for workflow, models, tools, context selection, and resume procedures. [AGENTS.md](../../AGENTS.md) owns repository safety and authority. [Task routes](agent-workflows.md) provides technical wayfinding.

## Bound the assignment

- Follow the user's intent and authorized scope. The main agent retains authority over scope, decisions, and final acceptance.
- State the outcome, owned files, working directory, branch/ref, permissions, focused checks, and success criteria.
- Include the ticket/spec, relevant source paths, repository instructions, and decisions already made. Read matching app glossaries and scoped instructions before changing code.
- Escalate decisions outside the assignment to the main agent. Further delegation requires authorization and must preserve the assignment's scope and permissions.
- Honor explicit authorization boundaries for commits and external writes. Never leak credentials or run destructive git commands.

## Preserve work across handoffs

Keep one writer per worktree, including formatting and lint fixes. Parallel writers need isolated worktrees. Do not edit an active writer's worktree.

Preserve existing changes and partial work. Before a handoff or replacement, inspect the actual diff and artifacts and confirm that the previous writer is inactive. A timeout does not prove that a writer stopped.

Record the objective, authorized decisions, working directory, branch/ref, partial changes, artifact paths, and check state. Include run identifiers when available. Pass those records to the next owner so work continues without discarding changes.

## Verify before acceptance

Follow the authoritative [two-loop testing policy](instructions/conventions.md#two-verification-loops). Each handoff declares changed behavior/files, selected focused checks and rationale, runtime mode/target, results, evidence paths, blockers, and residual risks. Distinguish passed, failed, blocked, and unverified checks. Expand focused coverage when findings cross a boundary.

The main agent reviews the actual diff and evidence, resolves findings, and grants final acceptance. Completion alone is not acceptance. One coordinator owns sequential heavy builds and final repository-wide production gates after all writers finish. Reviewers and fixing children do not run competing full gates. Independent Standards and Spec reviews cover the same integration candidate; repairs require focused checks, renewed final-diff review, and the complete final matrix for the resulting candidate. Planned tooling is not acceptance evidence.

For issue work, follow [ticket progress and close-out rules](issue-tracker.md). Keep implementation tickets open until merged and honor dependency blockers.
