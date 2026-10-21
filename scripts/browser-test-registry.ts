import { globSync } from "node:fs";
import { resolve } from "node:path";

export const browserSuites = [
  {
    name: "cost-tracker",
    app: "cost-tracker",
    config: "playwright.config.ts",
    targets: ["cost-tracker"],
    directory: "e2e",
    instant: false,
  },
  {
    name: "calculator",
    app: "calculator",
    config: "playwright.config.ts",
    targets: ["calculator"],
    directory: "e2e",
    instant: false,
  },
  {
    name: "merge",
    app: "calculator",
    config: "playwright.merge.config.ts",
    targets: ["calculator", "cost-tracker"],
    directory: "merge",
    instant: false,
  },
  {
    name: "instant",
    app: "calculator",
    config: "playwright.instant.config.ts",
    targets: ["calculator-instant"],
    directory: "e2e",
    instant: true,
  },
] as const;
export type BrowserSuite = (typeof browserSuites)[number];

export function browserFiles(root: string, suite: BrowserSuite): string[] {
  return globSync("**/*.spec.ts", {
    cwd: resolve(root, "apps", suite.app, "src/__tests__", suite.directory),
  })
    .filter(
      (file) =>
        suite.app !== "calculator" ||
        suite.directory === "merge" ||
        (file === "instant-shells.spec.ts") === suite.instant,
    )
    .sort();
}

export function assertBrowserCoverage(
  expected: string[],
  actual: string[],
): void {
  if (
    !expected.length ||
    expected.length !== actual.length ||
    new Set(actual).size !== actual.length ||
    expected.some((file) => !actual.includes(file))
  )
    throw new Error("Browser discovery does not match required inventory.");
}
