import { browserSuites, type BrowserSuite } from "./browser-test-registry";
import type { TestGroup } from "./nonbrowser-test-groups";

export interface ProductionOperations {
  create(): Promise<void>;
  start(
    target: "calculator" | "cost-tracker" | "calculator-instant",
  ): Promise<void>;
  pair(): Promise<void>;
  browser(suite: BrowserSuite): Promise<void>;
  releaseOrdinary(): Promise<void>;
}

export function fullProductionGroups(
  existing: TestGroup[],
  operations: ProductionOperations,
): TestGroup[] {
  const groups: TestGroup[] = [];
  for (const group of existing) {
    if (group.name === "managed-servers") {
      groups.push(
        {
          name: "managed-run",
          prerequisites: group.prerequisites.filter(
            (name) => name !== "storage/target",
          ),
          execution: "serial",
          run: () => operations.create(),
        },
        ...(["calculator", "cost-tracker"] as const).map((target) => ({
          name: `production/${target}`,
          prerequisites: [
            "managed-run",
            ...(target === "cost-tracker" ? ["storage/target"] : []),
          ],
          execution: "serial" as const,
          run: () => operations.start(target),
        })),
        {
          ...group,
          prerequisites: ["production/calculator", "production/cost-tracker"],
          execution: "serial",
          run: () => operations.pair(),
        },
      );
    } else {
      groups.push({
        ...group,
        execution: group.execution === "cleanup" ? "cleanup" : "serial",
        prerequisites:
          group.name === "calculator/live"
            ? ["production/calculator"]
            : group.name === "cost-tracker/live"
              ? ["production/cost-tracker", "storage/target"]
              : group.prerequisites,
      });
    }
  }
  const browserGroups: TestGroup[] = browserSuites
    .filter(({ instant }) => !instant)
    .map((suite) => ({
      name: `browser/${suite.name}`,
      prerequisites: suite.targets.map((target) => `production/${target}`),
      execution: "serial",
      run: () => operations.browser(suite),
    }));
  const instant = browserSuites.find(({ instant }) => instant)!;
  groups.push(
    ...browserGroups,
    {
      name: "production/release-ordinary",
      prerequisites: [],
      execution: "serial",
      run: () => operations.releaseOrdinary(),
    },
    {
      name: "production/calculator-instant",
      prerequisites: ["managed-run", "production/release-ordinary"],
      execution: "serial",
      run: () => operations.start("calculator-instant"),
    },
    {
      name: "browser/instant",
      prerequisites: ["production/calculator-instant"],
      execution: "serial",
      run: () => operations.browser(instant),
    },
  );
  return groups;
}
