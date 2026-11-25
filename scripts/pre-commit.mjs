import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const [root, snapshot] = process.argv.slice(2);
const git = (...args) => execFileSync("git", args, { cwd: root });
const paths = git("diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR")
  .toString()
  .split("\0")
  .filter(Boolean);
if (paths.length === 0) process.exit(0);

for (const dir of [
  "",
  ...["apps", "packages"].flatMap((parent) => pathsFromIndex(parent)),
]) {
  const modules = path.join(root, dir, "node_modules");
  if (existsSync(modules))
    symlinkSync(modules, path.join(snapshot, dir, "node_modules"), "dir");
}

function pathsFromIndex(parent) {
  return [
    ...new Set(
      git("ls-files", "-z", `${parent}/*/package.json`)
        .toString()
        .split("\0")
        .filter(Boolean)
        .map((file) => path.dirname(file)),
    ),
  ];
}

function runCaptured(binary, args) {
  const result = spawnSync(path.join(root, "node_modules/.bin", binary), args, {
    cwd: snapshot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function run(binary, args) {
  return runCaptured(binary, args).status;
}

/**
 * oxlint exits 1 when its arguments match no lintable file. That is normal for
 * a commit that only touches ignored paths, such as the vendored shadcn
 * primitives under `src/components/ui/**`, and is not a lint failure.
 */
function noFilesMatched(result) {
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const lines = output.split("\n").filter(Boolean);
  if (!lines.some((line) => line.startsWith("No files found"))) return false;
  return lines.every(
    (line) =>
      line.startsWith("No files found") || line.startsWith("Finished in "),
  );
}

function stageIfChanged(file, before) {
  const entry = git("ls-files", "-s", "--", file).toString();
  const mode = entry.slice(0, 6);
  if (mode !== "100644" && mode !== "100755") return;
  const after = readFileSync(path.join(snapshot, file));
  if (before.equals(after)) return;
  const hash = execFileSync(
    "git",
    ["hash-object", "-w", "--stdin", "--path", file],
    { cwd: root, input: after },
  );
  git("update-index", "--cacheinfo", `${mode},${hash.toString().trim()},${file}`);

  // The hook formats a snapshot of the index, so a fix landed in the commit
  // while the working tree kept the pre-fix content: commit and `git status`
  // disagreed until the next manual format. Carry the fix into the working tree
  // too, but only when that file is still exactly the staged content, so edits
  // the user has not staged are never overwritten.
  const worktreeFile = path.join(root, file);
  try {
    const worktree = readFileSync(worktreeFile);
    if (worktree.equals(before)) {
      writeFileSync(worktreeFile, after);
    } else {
      process.stderr.write(
        `pre-commit: ${file} has unstaged edits; the formatted version is staged only. ` +
          "Run the formatter again to align the working tree.\n",
      );
    }
  } catch {
    // Missing worktree file (deleted during the commit): nothing to align.
  }
}

function isRegularIndexFile(file) {
  const mode = git("ls-files", "-s", "--", file).toString().slice(0, 6);
  return mode === "100644" || mode === "100755";
}

const stagedFiles = paths.filter(isRegularIndexFile);

const format = stagedFiles.filter(
  (file) =>
    /\.(cjs|cts|css|json|jsonc|js|jsx|md|mdx|mjs|mts|ts|tsx|yaml|yml)$/.test(
      file,
    ) && !/^(docs|\.specify|specs)\//.test(file),
);
for (const file of format) {
  const target = path.join(snapshot, file);
  const before = readFileSync(target);
  if (
    run("oxfmt", ["--write", "--no-error-on-unmatched-pattern", "--", file]) !== 0
  )
    process.exit(1);
  stageIfChanged(file, before);
}

const lint = stagedFiles.filter((file) =>
  /\.(cjs|cts|js|jsx|mjs|mts|ts|tsx)$/.test(file),
);

const tailwindCandidates = stagedFiles.filter((file) =>
  /\.(jsx|tsx)$/.test(file),
);
if (tailwindCandidates.length) {
  const before = new Map(
    tailwindCandidates.map((file) => [
      file,
      readFileSync(path.join(snapshot, file)),
    ]),
  );
  // Two passes: collapsing `mt-2 mb-2` into `my-2` removes classes and leaves
  // the whitespace that no-unnecessary-whitespace normalises on the next pass.
  for (let pass = 0; pass < 2; pass += 1) {
    const result = runCaptured("oxlint", [
      "--config",
      "oxlint.tailwind.json",
      "--fix",
      "--",
      ...tailwindCandidates,
    ]);
    if (result.status !== 0 && !noFilesMatched(result)) process.exit(1);
  }
  for (const file of tailwindCandidates) stageIfChanged(file, before.get(file));
}

if (lint.length) {
  const result = spawnSync(
    path.join(root, "node_modules/.bin/oxlint"),
    ["--config", ".oxlintrc.json", "--", ...lint],
    { cwd: snapshot, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0 && !noFilesMatched(result)) process.exit(1);
}
if (run("tsx", ["scripts/check-agent-instructions.ts"]) !== 0) process.exit(1);
if (
  run("vitest", ["run", "scripts/check-agent-instructions.policy.test.ts"]) !== 0
)
  process.exit(1);
if (
  paths.some((file) =>
    /(^apps\/[^/]+\/(src\/__tests__\/(e2e|merge)\/|test\/e2e\/)|\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$)/.test(
      file,
    ),
  )
) {
  if (run("tsx", ["scripts/check-no-copy-assertions.ts"]) !== 0) process.exit(1);
}
