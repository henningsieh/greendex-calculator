// Process template: supervised issue-implementation chain.
// Launch with: subagent({ workflow: "docs/agents/workflows/issue-implementation.js",
//   args: { issue, branch, sources, tests, decisions, commitSubject, commitBody },
//   cwd: "/home/henning/_dev/greendex-cost-tracker", async: true, timeoutMs: 7200000 })
// All args are plain JSON. Model policy per lane: implement medium, test low,
// review high, fix medium, commit low (all on the project default model family).
// The supervisor (parent) answers contact_supervisor requests, posts issue
// progress comments, and owns final acceptance. No pushes, no merges.

const REPO = "/home/henning/_dev/greendex-cost-tracker";
const MODEL = "openai-codex/gpt-6.1-sol";

function implement() {
  return runs.run("implement", {
    label: "Implement issue change",
    agent: "worker",
    model: MODEL + ":medium",
    task: [
      "Objective: implement GitHub issue " + args.issue + " in cost-tracker.",
      "Repo/cwd/branch: " +
        REPO +
        ", branch " +
        args.branch +
        " (already checked out, clean tree). Do NOT switch branches. No commits, no pushes, never start a dev server.",
      "Authority: edit ONLY these source files: " +
        args.sources.join(", ") +
        ". Read-only everywhere else.",
      "Locked decisions: " + args.decisions,
      "Contracts: read the issue body first via `gh issue view ISSUE --json body`. Keep canonical glossary terms (GLOSSARY.md, apps/cost-tracker/GLOSSARY.md). Follow docs/agents/instructions/shadcn.md (variants/contracts, no-restyle) and docs/agents/instructions/code-standards.md.",
      "Expected output: <=200 words (files changed, decisions taken, verification done). Escalate via contact_supervisor on any product/scope doubt instead of guessing; do not spawn subagents.",
    ].join("\n"),
  });
}

function testLane(prior) {
  return runs.run("test", {
    label: "Update tests and run checks",
    agent: "worker",
    model: MODEL + ":low",
    task: [
      "Objective: tests + gates for issue " +
        args.issue +
        ". Prerequisite implementation handoff:",
      prior,
      "Repo: " +
        REPO +
        ", branch " +
        args.branch +
        ". No commits, no pushes, never start a dev server.",
      "Authority: edit ONLY these test files (locate exact paths first): " +
        args.tests.join(", ") +
        ". Read-only elsewhere.",
      "Validation: `pnpm run format`, focused `pnpm run lint:design-system` (zero new violations), repo `pnpm run lint` if feasible, and the affected unit tests. Report exact commands + pass/fail. Gate-required formatter autofixes outside your files may be kept only if mechanical; list them.",
      "Expected output: <=200 words (tests updated, checks with results). Escalate via contact_supervisor on doubt; do not spawn subagents.",
    ].join("\n"),
  });
}

function reviewLane(prior) {
  return runs.run("review", {
    label: "Review change against issue",
    agent: "reviewer",
    model: MODEL + ":high",
    task: [
      "Objective: independent read-only review of the uncommitted change for issue " +
        args.issue +
        ". Repo: " +
        REPO +
        ", branch " +
        args.branch +
        ".",
      "Authority: READ-ONLY. No edits, no commits, no pushes.",
      "Check against the issue body (`gh issue view ISSUE --json body`) and the prior handoffs:",
      prior,
      "Angles: acceptance criteria met; no scope creep; shadcn/no-restyle and code-standards compliance; test quality (StrictMode double-fire guards where toasts fire from effects).",
      "Expected output: concrete findings with file:line proof, then EXACTLY one final line: `Merge verdict: BLOCK` (with must-fix items) or `Merge verdict: OK` (or OK with notes). Escalate via contact_supervisor on doubt; do not spawn subagents.",
    ].join("\n"),
  });
}

function commitLane() {
  return runs.run("commit", {
    label: "Commit change",
    agent: "delegate",
    model: MODEL + ":low",
    task: [
      "Repo: " +
        REPO +
        ", branch " +
        args.branch +
        ". A review passed with Merge verdict: OK.",
      "git add ONLY the in-scope files (verify exact paths with git status first; never `git add -A`). Then commit with subject `" +
        args.commitSubject +
        "` and body `" +
        args.commitBody +
        "`. No push.",
      "Report commit hash + `git status --short`. Do not spawn subagents.",
    ].join("\n"),
  });
}

const implementResult = await implement();
const testResult = await testLane(implementResult.output);
const reviewResult = await reviewLane(
  implementResult.output + "\n" + testResult.output,
);
if (!reviewResult.output.includes("Merge verdict: BLOCK")) {
  const committed = await commitLane();
  return {
    implement: implementResult.output,
    test: testResult.output,
    review: reviewResult.output,
    commit: committed.output,
    committed: true,
  };
}
const fixed = await runs.run("fix", {
  label: "Fix review blockers",
  agent: "worker",
  model: MODEL + ":medium",
  task: [
    "Objective: fix ONLY the must-fix items from this BLOCK review (issue " +
      args.issue +
      "). Repo: " +
      REPO +
      ", branch " +
      args.branch +
      ". No commits, no pushes, never start a dev server.",
    "Review findings to fix:",
    reviewResult.output,
    "Authority: edit ONLY the files the findings implicate (stay inside the implementation/test file lists unless a finding proves otherwise — escalate via contact_supervisor if it does). Re-run format + affected tests.",
    "Expected output: <=200 words (items fixed, checks). Do not spawn subagents.",
  ].join("\n"),
});
const recheck = await runs.run("recheck", {
  label: "Re-check fixed change",
  agent: "reviewer",
  model: MODEL + ":high",
  task: [
    "Objective: read-only re-check of the fixed change for issue " +
      args.issue +
      ". Repo: " +
      REPO +
      ", branch " +
      args.branch +
      ". No edits, no commits.",
    "Fix handoff:",
    fixed.output,
    "Verify every BLOCK item is resolved; report remaining issues with file:line proof, ending EXACTLY with `Merge verdict: BLOCK` or `Merge verdict: OK`. Do not spawn subagents.",
  ].join("\n"),
});
if (recheck.output.includes("Merge verdict: BLOCK")) {
  return {
    implement: implementResult.output,
    test: testResult.output,
    review: reviewResult.output,
    fix: fixed.output,
    recheck: recheck.output,
    committed: false,
  };
}
const committed = await commitLane();
return {
  implement: implementResult.output,
  test: testResult.output,
  review: reviewResult.output,
  fix: fixed.output,
  recheck: recheck.output,
  commit: committed.output,
  committed: true,
};
