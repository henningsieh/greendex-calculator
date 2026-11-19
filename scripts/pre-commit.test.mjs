import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function fixture() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "hook-test-"));
  const repo = path.join(temp, "repo");
  execFileSync("git", ["clone", "-q", "--shared", root, repo]);
  symlinkSync(path.join(root, "node_modules"), path.join(repo, "node_modules"));
  for (const file of [".husky/pre-commit", "scripts/pre-commit.mjs"]) {
    cpSync(path.join(root, file), path.join(repo, file));
  }
  const git = (...args) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), content);
  };
  git("add", ".husky/pre-commit", "scripts/pre-commit.mjs");
  const hook = () =>
    spawnSync("sh", [".husky/pre-commit"], { cwd: repo, encoding: "utf8" });
  return { temp, repo, git, write, hook };
}
function check(name, fn) {
  test(name, () => {
    const f = fixture();
    try {
      fn(f);
    } finally {
      rmSync(f.temp, { recursive: true, force: true });
    }
  });
}
const file = "scripts/staged example.js";
check("staged valid, unstaged invalid and unrelated dirty config pass", (f) => {
  f.write(file, "export const answer = 42;\n");
  f.git("add", file);
  f.write(file, "export const = ;\n");
  f.write(".oxlintrc.json", "invalid json");
  f.write("apps/cost-tracker/src/env.ts", "export const = ;\n");
  f.write("scripts/untracked invalid.js", "export const = ;\n");
  const result = f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    readFileSync(path.join(f.repo, file), "utf8"),
    "export const = ;\n",
  );
});
check("staged invalid, unstaged valid fails", (f) => {
  const appFile = "apps/cost-tracker/src/staged-lint.ts";
  f.write(appFile, "const unused = 42;\nexport {};\n");
  f.git("add", appFile);
  f.write(appFile, "export const answer = 42;\n");
  const result = f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /no-unused-vars/);
});
check("formatter updates only staged bytes", (f) => {
  f.write(file, "export const answer={a:1}\n");
  f.git("add", file);
  const work = "export const answer={a:1}\n// unstaged\n";
  f.write(file, work);
  const result = f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.git("show", `:${file}`), "export const answer = { a: 1 };\n");
  assert.equal(readFileSync(path.join(f.repo, file), "utf8"), work);
});
check("instruction guard reads staged instructions", (f) => {
  const original = readFileSync(path.join(f.repo, "AGENTS.md"), "utf8");
  f.write(
    "AGENTS.md",
    original.replace("<!-- AGENT-INSTRUCTION-INDEX-START -->", ""),
  );
  f.git("add", "AGENTS.md");
  f.write("AGENTS.md", original);
  const result = f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /instruction|index/i);
});
check("unstaged instruction drift does not block", (f) => {
  const original = readFileSync(path.join(f.repo, "AGENTS.md"), "utf8");
  f.write(file, "export const answer = 42;\n");
  f.git("add", file);
  f.write(
    "AGENTS.md",
    original.replace("<!-- AGENT-INSTRUCTION-INDEX-START -->", ""),
  );
  const result = f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
check("copy guard reads staged tests", (f) => {
  const testFile = "apps/cost-tracker/src/staged-copy.test.ts";
  f.write(testFile, 'getByText("hello");\n');
  f.git("add", testFile);
  f.write(testFile, "export {};\n");
  const result = f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /check:no-copy-assertions FAILED/);
});
check("unstaged copy violation does not block", (f) => {
  const testFile = "apps/cost-tracker/src/staged-copy.test.ts";
  f.write(testFile, "export {};\n");
  f.git("add", testFile);
  f.write(testFile, 'getByText("hello");\n');
  const result = f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
