import { describe, expect, it } from "vitest";

import { fullRunPassed, runTestGroups } from "./nonbrowser-test-groups";

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
