import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { expect, it } from "vitest";

import {
  assertNonbrowserTestEvidence,
  nonbrowserTestEvidence,
} from "./nonbrowser-test-evidence";
import { runTestGroups } from "./nonbrowser-test-groups";

it("accounts for discovered-empty packages but fails missing required execution", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "greendex-empty-package-"));
  const root = resolve(import.meta.dirname, "..");
  const events: string[] = [];
  const evidence: ReturnType<typeof nonbrowserTestEvidence>[] = [];
  const report = () => {
    const output = execFileSync(
      process.execPath,
      [
        resolve(root, "node_modules/vitest/vitest.mjs"),
        "run",
        "--root",
        directory,
        "--passWithNoTests",
        "--maxWorkers=1",
        "--no-file-parallelism",
        `--reporter=${resolve(root, "scripts/nonbrowser-json-reporter.ts")}`,
      ],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return JSON.parse(output.slice(output.indexOf('{"numTotalTestSuites"')));
  };
  try {
    const emptyReport = report();
    const discoveredFiles = globSync("**/*.{test,spec}.{ts,tsx,js,mjs}", {
      cwd: directory,
    });
    const result = await runTestGroups([
      {
        name: "package/config",
        prerequisites: [],
        execution: "serial",
        run: async () => {
          const parsed = nonbrowserTestEvidence(
            emptyReport,
            "packages/config",
            root,
            {
              kind: "optional-package",
              discoveredFiles,
            },
          );
          evidence.push(parsed);
          assertNonbrowserTestEvidence(parsed);
          events.push("empty-accounted");
        },
      },
      {
        name: "app/required",
        prerequisites: [],
        execution: "serial",
        run: async () =>
          assertNonbrowserTestEvidence(
            nonbrowserTestEvidence(emptyReport, "apps/calculator", root),
          ),
      },
      {
        name: "independent",
        prerequisites: [],
        execution: "serial",
        run: async () => {
          events.push("independent");
        },
      },
    ]);
    expect(result.map(({ group, status }) => ({ group, status }))).toEqual([
      { group: "package/config", status: "passed" },
      { group: "app/required", status: "failed" },
      { group: "independent", status: "passed" },
    ]);
    expect(events).toEqual(["empty-accounted", "independent"]);
    expect(evidence[0]).toMatchObject({
      total: 0,
      emptyPolicy: "discovered-empty",
    });
    await writeFile(
      resolve(directory, "required.test.mjs"),
      'import { test, expect } from "' +
        resolve(root, "node_modules/vitest/dist/index.js") +
        '"; test("executes", () => expect(2 + 2).toBe(4));',
    );
    const discovered = globSync("**/*.test.mjs", { cwd: directory });
    expect(() =>
      assertNonbrowserTestEvidence(
        nonbrowserTestEvidence(emptyReport, "packages/config", root, {
          kind: "optional-package",
          discoveredFiles: discovered,
        }),
      ),
    ).toThrow("Required tests failed or were skipped.");
    const executed = nonbrowserTestEvidence(report(), "packages/config", root, {
      kind: "optional-package",
      discoveredFiles: discovered,
    });
    assertNonbrowserTestEvidence(executed);
    expect(executed).toMatchObject({
      total: 1,
      passed: 1,
      emptyPolicy: "required",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
