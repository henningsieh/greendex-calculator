import { globSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalSeedVersion } from "./canonical-seed-version";
import {
  fullRunPassed,
  nonbrowserPackages,
  runTestGroups,
} from "./nonbrowser-test-groups";

describe("canonical seed version", () => {
  it("changes when any seed implementation module changes", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "greendex-seed-version-"));
    const modules = [
      "seed.ts",
      "seed-cost-tracker.ts",
      "seed-scenarios.ts",
      "seed-tables.ts",
      "seed-review-scenarios.ts",
    ];
    try {
      for (const name of modules)
        await writeFile(resolve(directory, name), `original ${name}`);
      const version = await canonicalSeedVersion(directory);
      expect(await canonicalSeedVersion(directory)).toBe(version);
      for (const name of modules) {
        const path = resolve(directory, name);
        const original = await readFile(path);
        await writeFile(path, `changed ${name}`);
        expect(await canonicalSeedVersion(directory), name).not.toBe(version);
        await writeFile(path, original);
      }
      await writeFile(resolve(directory, "seed-additional.ts"), "new builder");
      expect(await canonicalSeedVersion(directory)).not.toBe(version);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("nonbrowser test groups", () => {
  it("registers a focused command and root group for every package with tests", () => {
    const root = resolve(import.meta.dirname, "..");
    const packagesRoot = resolve(root, "packages");
    const packageManifests = globSync("packages/*/package.json", { cwd: root });
    for (const manifestPath of packageManifests) {
      const packageDirectory = dirname(resolve(root, manifestPath));
      const testFiles = globSync(
        "**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
        {
          cwd: packageDirectory,
          exclude: ["node_modules/**", "dist/**", "coverage/**"],
        },
      );
      if (!testFiles.length) continue;
      const manifest: unknown = JSON.parse(
        readFileSync(resolve(root, manifestPath), "utf8"),
      );
      expect(manifest, manifestPath).toMatchObject({
        scripts: { "test:run": expect.stringMatching(/\bvitest\s+run\b/) },
      });
      expect(nonbrowserPackages, manifestPath).toContain(
        relative(packagesRoot, packageDirectory),
      );
    }
  });

  it("continues independent groups, blocks dependents, and never retries a group", async () => {
    const ran: string[] = [];
    const results = await runTestGroups([
      {
        name: "database",
        prerequisites: [],
        execution: "serial",
        run: async () => {
          ran.push("database");
          throw new Error("private secret");
        },
      },
      {
        name: "http",
        prerequisites: ["database"],
        execution: "serial",
        run: async () => {
          ran.push("http");
        },
      },
      {
        name: "policy",
        prerequisites: [],
        execution: "serial",
        run: async () => {
          ran.push("policy");
        },
      },
      {
        name: "cleanup",
        prerequisites: [],
        execution: "cleanup",
        run: async () => {
          ran.push("cleanup");
        },
      },
    ]);
    expect(ran).toEqual(["database", "policy", "cleanup"]);
    expect(results.map((result) => result.status)).toEqual([
      "failed",
      "blocked",
      "passed",
      "passed",
    ]);
    expect(JSON.stringify(results)).not.toContain("private secret");
    expect(fullRunPassed(results)).toBe(false);
  });

  it("runs opted-in independent groups concurrently and cleanup last", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const results = await runTestGroups([
      {
        name: "first",
        prerequisites: [],
        execution: "parallel",
        run: async () => {
          events.push("first:start");
          await gate;
          events.push("first:end");
        },
      },
      {
        name: "second",
        prerequisites: [],
        execution: "parallel",
        run: async () => {
          events.push("second:start");
          releaseFirst();
          events.push("second:end");
        },
      },
      {
        name: "cleanup",
        prerequisites: [],
        execution: "cleanup",
        run: async () => {
          events.push("cleanup");
        },
      },
    ]);
    expect(events).toEqual([
      "first:start",
      "second:start",
      "second:end",
      "first:end",
      "cleanup",
    ]);
    expect(results.map((result) => result.group)).toEqual([
      "first",
      "second",
      "cleanup",
    ]);
    expect(results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
  });

  it("does not overlap serial groups with parallel groups", async () => {
    const events: string[] = [];
    let activeParallel = 0;
    const results = await runTestGroups([
      {
        name: "parallel",
        prerequisites: [],
        execution: "parallel",
        run: async () => {
          activeParallel += 1;
          events.push("parallel:start");
          await new Promise((resolve) => setTimeout(resolve, 0));
          events.push("parallel:end");
          activeParallel -= 1;
        },
      },
      {
        name: "serial",
        prerequisites: [],
        execution: "serial",
        run: async () => {
          expect(activeParallel).toBe(0);
          events.push("serial");
        },
      },
    ]);
    expect(events).toEqual(["parallel:start", "parallel:end", "serial"]);
    expect(results.map(({ group }) => group)).toEqual(["parallel", "serial"]);
  });

  it("defers cleanup declared first and attempts every cleanup after work fails", async () => {
    const events: string[] = [];
    const results = await runTestGroups([
      {
        name: "release-first",
        prerequisites: [],
        execution: "cleanup",
        run: async () => {
          events.push("cleanup:first");
          throw new Error("private cleanup failure");
        },
      },
      {
        name: "work",
        prerequisites: [],
        execution: "parallel",
        run: async () => {
          events.push("work");
          throw new Error("private work failure");
        },
      },
      {
        name: "dependent",
        prerequisites: ["work"],
        execution: "serial",
        run: async () => {
          events.push("dependent");
        },
      },
      {
        name: "release-second",
        prerequisites: ["release-first"],
        execution: "cleanup",
        run: async () => {
          events.push("cleanup:second");
        },
      },
    ]);
    expect(events).toEqual(["work", "cleanup:first", "cleanup:second"]);
    expect(results.map(({ status }) => status)).toEqual([
      "failed",
      "failed",
      "blocked",
      "passed",
    ]);
    expect(fullRunPassed(results)).toBe(false);
  });

  it("rejects work that depends on deferred cleanup before acquiring resources", async () => {
    const events: string[] = [];
    await expect(
      runTestGroups([
        {
          name: "acquire",
          prerequisites: [],
          execution: "serial",
          run: async () => {
            events.push("acquire");
          },
        },
        {
          name: "release",
          prerequisites: [],
          execution: "cleanup",
          run: async () => {
            events.push("release");
          },
        },
        {
          name: "work",
          prerequisites: ["release"],
          execution: "serial",
          run: async () => {
            events.push("work");
          },
        },
      ]),
    ).rejects.toThrow("invalid prerequisite");
    expect(events).toEqual([]);
  });

  it("rejects duplicates and missing prerequisites before any execution", async () => {
    let ran = false;
    const group = {
      name: "unit",
      prerequisites: [],
      execution: "serial" as const,
      run: async () => {
        ran = true;
      },
    };
    await expect(runTestGroups([group, group])).rejects.toThrow();
    await expect(
      runTestGroups([{ ...group, prerequisites: ["missing"] }]),
    ).rejects.toThrow();
    expect(ran).toBe(false);
  });
  it("fails empty runs and cleanup errors", async () => {
    expect(fullRunPassed([])).toBe(false);
    const results = await runTestGroups([
      {
        name: "unit",
        prerequisites: [],
        execution: "serial",
        run: async () => {},
      },
      {
        name: "cleanup",
        prerequisites: [],
        execution: "cleanup",
        run: async () => {
          throw new Error("cleanup");
        },
      },
    ]);
    expect(fullRunPassed(results)).toBe(false);
    expect(fullRunPassed(results.slice(0, 1))).toBe(true);
  });
});
