import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalSeedVersion } from "./canonical-seed-version";
import { fullRunPassed, runTestGroups } from "./nonbrowser-test-groups";

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
  it("continues independent groups, blocks dependents, and never retries a group", async () => {
    const ran: string[] = [];
    const results = await runTestGroups([
      {
        name: "database",
        prerequisites: [],
        run: async () => {
          ran.push("database");
          throw new Error("private secret");
        },
      },
      {
        name: "http",
        prerequisites: ["database"],
        run: async () => {
          ran.push("http");
        },
      },
      {
        name: "policy",
        prerequisites: [],
        run: async () => {
          ran.push("policy");
        },
      },
      {
        name: "cleanup",
        prerequisites: [],
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
  it("rejects duplicates and missing prerequisites before any execution", async () => {
    let ran = false;
    const group = {
      name: "unit",
      prerequisites: [],
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
      { name: "unit", prerequisites: [], run: async () => {} },
      {
        name: "cleanup",
        prerequisites: [],
        run: async () => {
          throw new Error("cleanup");
        },
      },
    ]);
    expect(fullRunPassed(results)).toBe(false);
    expect(fullRunPassed(results.slice(0, 1))).toBe(true);
  });
});
