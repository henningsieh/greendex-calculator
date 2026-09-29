# Launching ticket subagents (proven pattern)

## Enable and discover

1. `subagents_enable()` — full tools appear on the next model request.
2. `subagent({action: "list", capabilities: true})` — executable agents and
   their tool contracts. `subagent({action: "models"})` — exact provider/ids.

## Launch one child

```js
subagent({
  agent: "worker",            // worker implements, reviewer reviews, delegate runs errands
  task: "<verbatim ticket command + cold-start contract, see below>",
  model: "openai-codex/gpt-6-sol:xhigh",
  maxRuntimeMs: 3600000,      // 60 min: integration suites + typegen need it
  // cwd defaults to runtime cwd; set explicitly or workers land in /tmp
})
```

Prefix each child's `task` prompt with the exact skill directive for its role — and only that role's directive:

- Implementation worker: `/skill:implement`
- Worker reviewing previous code changes: `/skill:code-review`
- Survey/recon scout (read-only inventory, classification, no edits): NO skill prefix — `/skill:implement` on a scout is wrong (scout tools are read-only anyway, but the directive misstates the role and confuses review).

Place the directive at the very start of the prompt, before the ticket command
and cold-start contract.

## Model and thinking

- Exact `provider/id` required; bare ids resolve only when unique. Verified
  working: `openai-codex/gpt-6-sol`.
- Thinking is a `:suffix`, not a field (`:xhigh`, `:high`, `:medium`, …).
  The `thinking` field is ignored on dispatch.
- Used here: scouts `medium` (read-only survey is well-scoped), workers `high` (complex) or `medium` (well-scoped), reviewers
  `xhigh`. Always verify resolution in `status` output (`gpt-6-sol ·
  thinking xhigh`) — never assume; a typo silently falls back.
- Async is default. Monitor via native notifications; `status` (+
  `view: "transcript"`) to inspect, `steer` for live guidance,
  `subagent_supervisor({action: "reply", replyTo, message})` for child
  decisions. `stop` kills; stopped runs are not resumable — relaunch fresh.

## Cold-start packet (every launch carries one)

Goal, target (cwd/branch/ref), authority boundary (allow: read/edit/test/
commit/comment; forbid: push/merge/close/prod-DB/credentials), handoffs
(files and prior commits to consume, never rebuild), hard constraints
(invariants, migration numbering, commit style), validation (exact suites,
`--testTimeout=15000`, serial runs), output shape (summary, hash, evidence,
deferrals), stop/escalate rules.

## Gotchas earned the hard way

- One writer per worktree/branch; reviewers are read-only and parallel-safe.
- Integration suites take ~4 min: set extended deadlines up front, run serially.
- Never `pkill -f` with a pattern present in your own command line (kills
  your shell); kill by exact PID instead.
- Subagents default cwd is not the repo — pass `cwd` or work lands elsewhere
  (plus trust prompts outside trusted dirs).
- Match the skill directive to the role: scout prompts carry no `/skill:`
  prefix; only worker prompts carry `/skill:implement` (2026-09-29).
- Close-out rhythm per ticket: progress comment, keep open, merge, close.
  Stopped runs cannot resume; timed-out runs recover via inventory + landing
  worker, never by re-implementing.
