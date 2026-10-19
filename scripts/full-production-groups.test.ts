import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  browserFiles,
  browserSuites,
  assertBrowserCoverage,
} from "./browser-test-registry";
import {
  fullProductionGroups,
  type ProductionOperations,
} from "./full-production-groups";
import {
  fullRunPassed,
  runTestGroups,
  type TestGroup,
} from "./nonbrowser-test-groups";

function existing(events: string[]): TestGroup[] {
  const inventory: [string, string[]][] = [
    ["repository", []],
    ...["auth", "email", "database", "config", "i18n"].map(
      (name): [string, string[]] => [`package/${name}`, []],
    ),
    ["calculator/pure", []],
    ["cost-tracker/pure", []],
    ["database/create", []],
    ["database/migrate", ["database/create"]],
    ["database/seed", ["database/migrate"]],
    ["calculator/migrations-and-seed-contract", ["database/create"]],
    ["managed-servers", ["database/seed"]],
    ["calculator/live", ["managed-servers"]],
    ["cost-tracker/live", ["managed-servers"]],
    ["live-mail", ["managed-servers"]],
    ["development-garage", []],
    ["cleanup/servers", []],
    ["cleanup/database", []],
  ];
  return inventory.map(([name, prerequisites]) => ({
    name,
    prerequisites,
    execution: name.startsWith("cleanup/") ? "cleanup" : "parallel",
    run: async () => {
      events.push(name);
    },
  }));
}
function operations(events: string[], failure?: string): ProductionOperations {
  const run = async (name: string) => {
    events.push(name);
    if (name === failure) throw new Error("private-secret");
  };
  return {
    create: () => run("create"),
    start: (target) => run(`start/${target}`),
    pair: () => run("pair"),
    browser: (suite) => run(`browser/${suite.name}`),
    releaseOrdinary: () => run("release"),
  };
}

describe("full production matrix", () => {
  it("preserves each existing group once, runs all four suites once, and releases ordinary targets before instant", async () => {
    const events: string[] = [];
    const old = existing(events);
    const groups = fullProductionGroups(old, operations(events));
    for (const group of old)
      expect(groups.filter(({ name }) => name === group.name)).toHaveLength(1);
    expect(
      groups.every(
        ({ execution }) => execution === "serial" || execution === "cleanup",
      ),
    ).toBe(true);
    const results = await runTestGroups(groups);
    expect(fullRunPassed(results)).toBe(true);
    expect(events.filter((name) => name.startsWith("browser/"))).toEqual([
      "browser/cost-tracker",
      "browser/calculator",
      "browser/merge",
      "browser/instant",
    ]);
    expect(events.indexOf("release")).toBeGreaterThan(
      events.indexOf("browser/merge"),
    );
    expect(events.indexOf("start/calculator-instant")).toBeGreaterThan(
      events.indexOf("release"),
    );
    expect(events.slice(-2)).toEqual(["cleanup/servers", "cleanup/database"]);
  });
  it.each(["calculator", "cost-tracker"])(
    "continues the independent app when %s production fails",
    async (target) => {
      const events: string[] = [];
      const results = await runTestGroups(
        fullProductionGroups(
          existing(events),
          operations(events, `start/${target}`),
        ),
      );
      const other = target === "calculator" ? "cost-tracker" : "calculator";
      expect(events).toContain(`browser/${other}`);
      expect(events).toContain(`${other}/live`);
      expect(events).not.toContain(`browser/${target}`);
      expect(events).not.toContain("browser/merge");
      expect(events).not.toContain("live-mail");
      expect(events).toContain("browser/instant");
      expect(
        results.find(({ group }) => group === `browser/${target}`)?.status,
      ).toBe("blocked");
      expect(fullRunPassed(results)).toBe(false);
      expect(JSON.stringify(results)).not.toContain("private-secret");
    },
  );
  it("blocks instant after ordinary release failure and always cleans up", async () => {
    const events: string[] = [];
    const results = await runTestGroups(
      fullProductionGroups(existing(events), operations(events, "release")),
    );
    expect(events).not.toContain("start/calculator-instant");
    expect(events.slice(-2)).toEqual(["cleanup/servers", "cleanup/database"]);
    expect(fullRunPassed(results)).toBe(false);
  });
  it("continues safe direct checks when lifecycle acquisition fails", async () => {
    const events: string[] = [];
    const results = await runTestGroups(
      fullProductionGroups(existing(events), operations(events, "create")),
    );
    expect(events).toContain("package/auth");
    expect(events).toContain("calculator/migrations-and-seed-contract");
    expect(events).toContain("development-garage");
    expect(events.some((name) => name.startsWith("browser/"))).toBe(false);
    expect(events.slice(-2)).toEqual(["cleanup/servers", "cleanup/database"]);
    expect(fullRunPassed(results)).toBe(false);
  });
  it("does not suppress merge or instant after an ordinary browser assertion fails", async () => {
    const events: string[] = [];
    const results = await runTestGroups(
      fullProductionGroups(
        existing(events),
        operations(events, "browser/calculator"),
      ),
    );
    expect(events).toContain("browser/merge");
    expect(events).toContain("browser/instant");
    expect(
      results.find(({ group }) => group === "browser/calculator")?.status,
    ).toBe("failed");
    expect(fullRunPassed(results)).toBe(false);
  });
  it("keeps ordinary evidence and cleanup after the instant build fails", async () => {
    const events: string[] = [];
    const results = await runTestGroups(
      fullProductionGroups(
        existing(events),
        operations(events, "start/calculator-instant"),
      ),
    );
    expect(events).toContain("browser/calculator");
    expect(events).not.toContain("browser/instant");
    expect(results.find(({ group }) => group === "browser/instant")?.status).toBe(
      "blocked",
    );
    expect(events.slice(-2)).toEqual(["cleanup/servers", "cleanup/database"]);
    expect(fullRunPassed(results)).toBe(false);
  });
  it("partitions source browser files across exactly the four required configurations", () => {
    const root = resolve(import.meta.dirname, "..");
    expect(browserSuites.map(({ config, app }) => `${app}/${config}`)).toEqual([
      "cost-tracker/playwright.config.ts",
      "calculator/playwright.config.ts",
      "calculator/playwright.merge.config.ts",
      "calculator/playwright.instant.config.ts",
    ]);
    const inventories = browserSuites.map((suite) => browserFiles(root, suite));
    expect(inventories.every((files) => files.length > 0)).toBe(true);
    expect(inventories[1]).not.toContain("instant-shells.spec.ts");
    expect(inventories[3]).toEqual(["instant-shells.spec.ts"]);
    assertBrowserCoverage(inventories[1], inventories[1]);
    expect(() => assertBrowserCoverage(inventories[1], [])).toThrow();
    expect(() =>
      assertBrowserCoverage(["one.spec.ts"], ["one.spec.ts", "one.spec.ts"]),
    ).toThrow();
    expect(() =>
      assertBrowserCoverage(["one.spec.ts"], ["other.spec.ts"]),
    ).toThrow();
  });
});
