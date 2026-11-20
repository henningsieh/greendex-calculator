import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
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
import { fileURLToPath } from "node:url";

import { test } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Each case runs the real hook, including its separate Vitest policy process.
const hookCheckTimeoutMs = 30_000;
function fixture() {
  const temp = mkdtempSync(path.join(os.tmpdir(), "hook-test-"));
  const repo = path.join(temp, "repo");
  execFileSync("git", ["clone", "-q", "--shared", root, repo]);
  symlinkSync(path.join(root, "node_modules"), path.join(repo, "node_modules"));
  for (const file of [".husky/pre-commit", "scripts/pre-commit.mjs"]) {
    cpSync(path.join(root, file), path.join(repo, file));
  }
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), content);
  };
  git("add", ".husky/pre-commit", "scripts/pre-commit.mjs");
  const hook = () =>
    new Promise<{ status: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn("sh", [".husky/pre-commit"], {
          cwd: repo,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const timer = setTimeout(() => {
          if (child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              // The process already exited.
            }
          }
        }, hookCheckTimeoutMs);
        let stdout = "";
        let stderr = "";
        child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
          stdout += chunk;
        });
        child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
          stderr += chunk;
        });
        child.on("error", (error) => {
          clearTimeout(timer);
          resolve({ status: null, stdout, stderr: `${stderr}${error.message}` });
        });
        child.on("close", (status) => {
          clearTimeout(timer);
          resolve({ status, stdout, stderr });
        });
      },
    );
  return { temp, repo, git, write, hook };
}
// Each case owns its clone and temporary directory. The hook itself creates a
// fresh staged snapshot with `mktemp`, so the real hooks can run concurrently
// without sharing an index or a working tree.
function check(
  name: string,
  fn: (context: ReturnType<typeof fixture>) => Promise<void>,
) {
  test.concurrent(
    name,
    async () => {
      const f = fixture();
      try {
        await fn(f);
      } finally {
        rmSync(f.temp, { recursive: true, force: true });
      }
    },
    hookCheckTimeoutMs,
  );
}
const file = "scripts/staged example.js";
check(
  "staged valid, unstaged invalid and unrelated dirty config pass",
  async (f) => {
    f.write(file, "export const answer = 42;\n");
    f.git("add", file);
    f.write(file, "export const = ;\n");
    f.write(".oxlintrc.json", "invalid json");
    f.write("apps/cost-tracker/src/env.ts", "export const = ;\n");
    f.write("scripts/untracked invalid.js", "export const = ;\n");
    const result = await f.hook();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(
      readFileSync(path.join(f.repo, file), "utf8"),
      "export const = ;\n",
    );
  },
);
check("staged invalid, unstaged valid fails", async (f) => {
  const appFile = "apps/cost-tracker/src/staged-lint.ts";
  f.write(appFile, "const unused = 42;\nexport {};\n");
  f.git("add", appFile);
  f.write(appFile, "export const answer = 42;\n");
  const result = await f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /no-unused-vars/);
});
check("formatter updates only staged bytes", async (f) => {
  f.write(file, "export const answer={a:1}\n");
  f.git("add", file);
  const work = "export const answer={a:1}\n// unstaged\n";
  f.write(file, work);
  const result = await f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.git("show", `:${file}`), "export const answer = { a: 1 };\n");
  assert.equal(readFileSync(path.join(f.repo, file), "utf8"), work);
});
check("instruction guard reads staged instructions", async (f) => {
  const original = readFileSync(path.join(f.repo, "AGENTS.md"), "utf8");
  f.write(
    "AGENTS.md",
    original.replace("<!-- AGENT-INSTRUCTION-INDEX-START -->", ""),
  );
  f.git("add", "AGENTS.md");
  f.write("AGENTS.md", original);
  const result = await f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /instruction|index/i);
});
check("unstaged instruction drift does not block", async (f) => {
  const original = readFileSync(path.join(f.repo, "AGENTS.md"), "utf8");
  f.write(file, "export const answer = 42;\n");
  f.git("add", file);
  f.write(
    "AGENTS.md",
    original.replace("<!-- AGENT-INSTRUCTION-INDEX-START -->", ""),
  );
  const result = await f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
check("copy guard reads staged tests", async (f) => {
  const testFile = "apps/cost-tracker/src/staged-copy.test.ts";
  f.write(testFile, 'getByText("hello");\n');
  f.git("add", testFile);
  f.write(testFile, "export {};\n");
  const result = await f.hook();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /check:no-copy-assertions FAILED/);
});
check("unstaged copy violation does not block", async (f) => {
  const testFile = "apps/cost-tracker/src/staged-copy.test.ts";
  f.write(testFile, "export {};\n");
  f.git("add", testFile);
  f.write(testFile, 'getByText("hello");\n');
  const result = await f.hook();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test.concurrent(
  "keeps two concurrent staged scopes isolated",
  async () => {
    const passing = fixture();
    const failing = fixture();
    try {
      passing.write(file, "export const answer = 42;\n");
      passing.git("add", file);
      const failingFile = "apps/cost-tracker/src/staged-lint.ts";
      failing.write(failingFile, "const unused = 42;\nexport {};\n");
      failing.git("add", failingFile);

      const [passed, failed] = await Promise.all([
        passing.hook(),
        failing.hook(),
      ]);

      assert.equal(passed.status, 0, passed.stdout + passed.stderr);
      assert.notEqual(failed.status, 0);
      assert.match(failed.stdout + failed.stderr, /no-unused-vars/);
      assert.equal(
        readFileSync(path.join(passing.repo, file), "utf8"),
        "export const answer = 42;\n",
      );
      assert.equal(
        readFileSync(path.join(failing.repo, failingFile), "utf8"),
        "const unused = 42;\nexport {};\n",
      );
    } finally {
      rmSync(passing.temp, { recursive: true, force: true });
      rmSync(failing.temp, { recursive: true, force: true });
    }
  },
  hookCheckTimeoutMs,
);
